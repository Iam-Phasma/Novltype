// Device signals are heuristic; touch alone must not block desktop laptops.
export function isPhoneOrTablet(device = navigator) {
  const ua = device.userAgent || "";
  const platform = device.userAgentData?.platform || device.platform || "";
  if (device.userAgentData?.mobile === true) return true;
  if (/android|iphone|ipad|ipod|mobile|tablet|kindle|silk|playbook/i.test(`${ua} ${platform}`)) {
    return true;
  }
  // iPadOS can advertise a desktop Mac identity.
  return /mac/i.test(platform) && device.maxTouchPoints > 1;
}

export function getAccessBlockReason(device, viewportWidth) {
  if (isPhoneOrTablet(device)) return "device";
  return viewportWidth <= 700 ? "window" : null;
}

export function isAccessBlocked() {
  return getAccessBlockReason(navigator, window.innerWidth) !== null;
}

export function initDeviceAccess() {
  const app = document.getElementById("app");
  const message = document.getElementById("access-message");
  const overlay = document.getElementById("mobile-block");
  let previous;
  function update() {
    const reason = getAccessBlockReason(navigator, window.innerWidth);
    document.body.classList.toggle("access-blocked", reason !== null);
    app.inert = reason !== null;
    overlay.setAttribute("aria-hidden", String(reason === null));
    message.textContent = reason === "device"
      ? "Built for the full keyboard experience. Open on a desktop or laptop to start typing."
      : "Give your words a little more room. Widen your browser window to start typing.";
    if (reason !== previous) {
      window.dispatchEvent(new CustomEvent("deviceaccesschange"));
      previous = reason;
    }
  }
  update();
  window.addEventListener("resize", update);
}
