/**
 * Pure, provider-independent routing contract for customer OTP transport.
 * Never send an enabled store's OTP via another tenant's global API key.
 * Intentionally has no runtime, database or network dependencies.
 */
export function isStoreSmsGatewayEnabled(config) {
  const storeConfig = config && typeof config === "object" && !Array.isArray(config) ? config : {};
  const messageSettings = storeConfig.message_settings && typeof storeConfig.message_settings === "object"
    ? storeConfig.message_settings : {};
  const smsSettings = messageSettings.sms && typeof messageSettings.sms === "object"
    ? messageSettings.sms : {};
  return smsSettings.use_sms_gateway === true
    || (messageSettings.sms === undefined && storeConfig.use_sms_gateway === true);
}

/**
 * @returns {{ok:true, key:string, source:"store"|"global"}|{ok:false,error:"sms_gateway_not_configured"}}
 */
export function resolveOtpGatewayCredential(store, globalApiKey) {
  const enabled = isStoreSmsGatewayEnabled(store?.config);
  if (enabled) {
    const token = String(store?.sms_gateway_token || "").trim();
    if (!/^osg_live_[A-Za-z0-9_-]{24,}$/.test(token)) {
      return { ok: false, error: "sms_gateway_not_configured" };
    }
    return { ok: true, key: token, source: "store" };
  }
  const globalKey = String(globalApiKey || "");
  return globalKey
    ? { ok: true, key: globalKey, source: "global" }
    : { ok: false, error: "sms_gateway_not_configured" };
}
