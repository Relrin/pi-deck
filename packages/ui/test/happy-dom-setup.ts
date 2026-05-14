import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!globalThis.document) {
  GlobalRegistrator.register({ url: "http://localhost/" });
}
