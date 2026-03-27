import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  const locale = "zh-TW";

  return {
    locale,
    messages: (await import(`./${locale}.json`)).default,
  };
});
