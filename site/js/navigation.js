/* Navigation — mobile drawer + accordion (Figma: Navigation · Layout=Mobile / Mobile Open).
   Desktop needs no script: the bar and dropdowns are pure :hover / :focus-within.
   Below Tablet the Main Menu button opens the drawer, and items with a submenu
   expand in place instead of navigating. */
(() => {
  const wrap = document.querySelector('[data-sc-pattern="navigation"]');
  if (!wrap) return;
  const toggle = wrap.querySelector(".navigation_toggle");
  const drawer = wrap.querySelector("#nav-drawer");
  const mobile = window.matchMedia("(max-width: 991px)");

  const setOpen = (open) => {
    wrap.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    document.documentElement.classList.toggle("is-nav-open", open);
  };

  toggle.addEventListener("click", () => setOpen(!wrap.classList.contains("is-open")));

  wrap.querySelectorAll(".navigation_item.has-menu > .navigation_link").forEach((link) => {
    link.setAttribute("aria-expanded", "false");
    link.addEventListener("click", (e) => {
      if (!mobile.matches) return;
      e.preventDefault();
      const item = link.parentElement;
      const open = !item.classList.contains("is-open");
      item.classList.toggle("is-open", open);
      link.setAttribute("aria-expanded", String(open));
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && wrap.classList.contains("is-open")) { setOpen(false); toggle.focus(); }
  });

  // Leaving the mobile layout with the drawer open should not strand a scroll lock.
  mobile.addEventListener("change", (e) => { if (!e.matches) setOpen(false); });

  // Open the first submenu by default, as drawn in Mobile Open.
  const first = drawer.querySelector(".navigation_item.has-menu");
  if (first) { first.classList.add("is-open"); first.firstElementChild.setAttribute("aria-expanded", "true"); }
})();
