class ComponentLoader {
  static BASE = "../../components";

  static async load() {
    const components = document.querySelectorAll("[data-component]");

    // Fetch every component in parallel instead of one at a time. With a
    // dozen [data-component] blocks on a page, awaiting each fetch
    // sequentially can take well over a second combined -- long enough
    // that a page's fixed-delay boot fallback (e.g. "start after 600ms")
    // fires before the real content exists, silently rendering against
    // empty containers. Promise.all collapses that to ~1 request's worth
    // of time and keeps each component's own error isolated.
    await Promise.all(
      Array.from(components).map(async (element) => {
        const component = element.dataset.component;

        try {
          const response = await fetch(`${this.BASE}/${component}.html`);

          if (!response.ok) {
            throw new Error(`${component}.html not found.`);
          }

          element.innerHTML = await response.text();
        } catch (error) {
          console.error(
            "[ComponentLoader]",

            error.message,
          );
        }
      }),
    );
  }

  static async loadInto(selector, component) {
    const container = document.querySelector(selector);

    if (!container) {
      return;
    }

    try {
      const response = await fetch(`${this.BASE}/${component}.html`);

      if (!response.ok) {
        throw new Error(`${component}.html not found.`);
      }

      container.innerHTML = await response.text();
    } catch (error) {
      console.error(
        "[ComponentLoader]",

        error.message,
      );
    }
  }
}

window.ComponentLoader = ComponentLoader;

document.addEventListener(
  "DOMContentLoaded",

  async () => {
    await ComponentLoader.load();

    document.dispatchEvent(new CustomEvent("components:loaded"));
  },
);
