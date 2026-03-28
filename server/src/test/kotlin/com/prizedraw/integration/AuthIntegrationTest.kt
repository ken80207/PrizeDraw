package com.prizedraw.integration

import com.prizedraw.api.plugins.configureCORS
import com.prizedraw.api.plugins.configureRateLimit
import com.prizedraw.api.plugins.configureSecurity
import com.prizedraw.api.plugins.configureSerialization
import com.prizedraw.api.plugins.configureStatusPages
import com.prizedraw.api.routes.authRoutes
import com.prizedraw.application.ports.input.auth.IBindPhoneUseCase
import com.prizedraw.application.ports.input.auth.ILoginUseCase
import com.prizedraw.application.ports.input.auth.ILogoutUseCase
import com.prizedraw.application.ports.input.auth.IRefreshTokenUseCase
import com.prizedraw.application.ports.input.auth.ISendOtpUseCase
import com.prizedraw.application.ports.output.IStaffRepository
import com.prizedraw.application.services.StaffTokenService
import com.prizedraw.application.services.TokenService
import com.prizedraw.application.usecases.auth.AuthException
import com.prizedraw.application.usecases.auth.OtpInvalidException
import com.prizedraw.application.usecases.auth.PhoneAlreadyBoundException
import com.prizedraw.contracts.dto.auth.TokenResponse
import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.domain.valueobjects.PlayerId
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldNotBeEmpty
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import kotlinx.datetime.Clock
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.koin.core.context.stopKoin
import org.koin.dsl.module
import org.koin.ktor.plugin.Koin
import java.util.UUID

/**
 * Integration tests for the authentication flow.
 *
 * Uses Ktor's [testApplication] builder with a Koin module containing mocked use cases.
 * A real [TokenService] instance with a fixed test secret is used to generate valid JWTs,
 * avoiding MockK value-class interoperability issues with [PlayerId].
 *
 * Test scenarios:
 * 1. POST /api/v1/auth/login — successful OAuth login returns tokens
 * 2. POST /api/v1/auth/login — invalid token returns 401
 * 3. POST /api/v1/auth/login — malformed body returns 4xx
 * 4. POST /api/v1/auth/otp/send — OTP dispatch returns 204
 * 5. POST /api/v1/auth/phone/bind — successful binding returns 200
 * 6. POST /api/v1/auth/phone/bind — invalid OTP returns 422
 * 7. POST /api/v1/auth/phone/bind — already-bound phone returns 409
 * 8. POST /api/v1/auth/phone/bind — unauthenticated returns 401
 */
class AuthIntegrationTest :
    DescribeSpec({

        val mockLoginUseCase = mockk<ILoginUseCase>()
        val mockRefreshUseCase = mockk<IRefreshTokenUseCase>()
        val mockSendOtpUseCase = mockk<ISendOtpUseCase>()
        val mockLogoutUseCase = mockk<ILogoutUseCase>()
        val mockBindPhoneUseCase = mockk<IBindPhoneUseCase>()
        val mockStaffTokenService = mockk<StaffTokenService>()
        val mockStaffRepository = mockk<IStaffRepository>()

        val testPlayerId = PlayerId(UUID.randomUUID())

        // Use a real TokenService with a fixed 256-bit test secret so that verifyAccessToken
        // works correctly without MockK value-class mangling on PlayerId.
        val mockRefreshTokenFamilyStore = mockk<TokenService.RefreshTokenFamilyStore>()
        val realTokenService =
            TokenService(
                config =
                    TokenService.TokenConfig(
                        jwtSecret = "test-secret-key-minimum-256-bits-long-padding",
                        accessTokenTtlSeconds = 3600L,
                        issuer = "prizedraw",
                    ),
                refreshTokenFamilyStore = mockRefreshTokenFamilyStore,
            )

        // Generate a valid access token for testPlayerId once — reused across all phone/bind tests.
        val testAccessToken: String =
            runBlocking {
                coEvery { mockRefreshTokenFamilyStore.save(any()) } answers { firstArg() }
                realTokenService.createTokenPair(testPlayerId).accessToken
            }

        val testTokenResponse =
            TokenResponse(
                accessToken = testAccessToken,
                refreshToken = "test.refresh.token",
                expiresIn = 900L,
            )

        val testPlayerDto =
            PlayerDto(
                id = testPlayerId.value.toString(),
                nickname = "TestUser",
                playerCode = "TESTCODE",
                avatarUrl = null,
                phoneNumber = "+886912345678",
                drawPointsBalance = 0,
                revenuePointsBalance = 0,
                preferredAnimationMode = DrawAnimationMode.TEAR,
                locale = "zh-TW",
                isActive = true,
                createdAt = Clock.System.now(),
                followerCount = 0,
                followingCount = 0,
            )

        afterEach {
            clearAllMocks()
            stopKoin()
        }

        fun Application.testModule() {
            install(Koin) {
                modules(
                    module {
                        single<ILoginUseCase> { mockLoginUseCase }
                        single<IRefreshTokenUseCase> { mockRefreshUseCase }
                        single<ISendOtpUseCase> { mockSendOtpUseCase }
                        single<ILogoutUseCase> { mockLogoutUseCase }
                        single<IBindPhoneUseCase> { mockBindPhoneUseCase }
                        single<TokenService> { realTokenService }
                        single<StaffTokenService> { mockStaffTokenService }
                        single<IStaffRepository> { mockStaffRepository }
                    },
                )
            }
            configureSerialization()
            configureCORS()
            configureRateLimit()
            configureStatusPages()
            configureSecurity()
            routing { authRoutes() }
        }

        describe("POST /api/v1/auth/login") {
            it("returns 200 with access and refresh tokens on successful OAuth login") {
                coEvery { mockLoginUseCase.execute(any()) } returns testTokenResponse

                testApplication {
                    application { testModule() }

                    val response =
                        client.post("/api/v1/auth/login") {
                            contentType(ContentType.Application.Json)
                            setBody("""{"provider":"GOOGLE","idToken":"valid.google.id.token"}""")
                        }

                    response.status shouldBe HttpStatusCode.OK
                    val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
                    body["accessToken"]?.jsonPrimitive?.content.shouldNotBeEmpty()
                    body["refreshToken"]?.jsonPrimitive?.content.shouldNotBeEmpty()
                }
            }

            it("returns 401 when OAuth token is invalid") {
                coEvery {
                    mockLoginUseCase.execute(any())
                } throws AuthException("Invalid id_token")

                testApplication {
                    application { testModule() }

                    val response =
                        client.post("/api/v1/auth/login") {
                            contentType(ContentType.Application.Json)
                            setBody("""{"provider":"GOOGLE","idToken":"invalid.token"}""")
                        }

                    response.status shouldBe HttpStatusCode.Unauthorized
                }
            }

            it("returns a non-200 status when request body is malformed") {
                testApplication {
                    application { testModule() }

                    val response =
                        client.post("/api/v1/auth/login") {
                            contentType(ContentType.Application.Json)
                            setBody("""{"not":"valid"}""")
                        }

                    // 400 or 422 — serialization/validation error
                    response.status.value shouldNotBe HttpStatusCode.OK.value
                }
            }
        }

        describe("POST /api/v1/auth/otp/send") {
            it("returns 204 when OTP is dispatched successfully") {
                coEvery { mockSendOtpUseCase.execute(any()) } returns Unit

                testApplication {
                    application { testModule() }

                    val response =
                        client.post("/api/v1/auth/otp/send") {
                            contentType(ContentType.Application.Json)
                            setBody("""{"phoneNumber":"+886912345678"}""")
                        }

                    response.status shouldBe HttpStatusCode.NoContent
                }
            }
        }

        describe("POST /api/v1/auth/phone/bind") {
            it("returns 200 with updated player DTO when phone is bound successfully") {
                coEvery { mockBindPhoneUseCase.execute(any(), any()) } returns testPlayerDto

                testApplication {
                    application { testModule() }

                    val response =
                        client.post("/api/v1/auth/phone/bind") {
                            contentType(ContentType.Application.Json)
                            bearerAuth(testAccessToken)
                            setBody("""{"phoneNumber":"+886912345678","otpCode":"123456"}""")
                        }

                    response.status shouldBe HttpStatusCode.OK
                    val body = Json.parseToJsonElement(response.bodyAsText()).jsonObject
                    body["phoneNumber"]?.jsonPrimitive?.content shouldBe "+886912345678"
                }
            }

            it("returns 422 when OTP code is invalid") {
                coEvery {
                    mockBindPhoneUseCase.execute(any(), any())
                } throws OtpInvalidException("OTP is incorrect or expired")

                testApplication {
                    application { testModule() }

                    val response =
                        client.post("/api/v1/auth/phone/bind") {
                            contentType(ContentType.Application.Json)
                            bearerAuth(testAccessToken)
                            setBody("""{"phoneNumber":"+886912345678","otpCode":"000000"}""")
                        }

                    response.status shouldBe HttpStatusCode.UnprocessableEntity
                }
            }

            it("returns 409 when phone number is already bound to another account") {
                coEvery {
                    mockBindPhoneUseCase.execute(any(), any())
                } throws PhoneAlreadyBoundException("Phone number already bound")

                testApplication {
                    application { testModule() }

                    val response =
                        client.post("/api/v1/auth/phone/bind") {
                            contentType(ContentType.Application.Json)
                            bearerAuth(testAccessToken)
                            setBody("""{"phoneNumber":"+886912345678","otpCode":"123456"}""")
                        }

                    response.status shouldBe HttpStatusCode.Conflict
                }
            }

            it("returns 401 when no bearer token is provided") {
                testApplication {
                    application { testModule() }

                    val response =
                        client.post("/api/v1/auth/phone/bind") {
                            contentType(ContentType.Application.Json)
                            setBody("""{"phoneNumber":"+886912345678","otpCode":"123456"}""")
                        }

                    response.status shouldBe HttpStatusCode.Unauthorized
                }
            }
        }
    })
