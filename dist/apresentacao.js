(() => {
  'use strict';
  const tablist = document.querySelector('[role="tablist"]');
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const narrow = window.matchMedia('(max-width: 820px)');
  const orientation = () => tablist.setAttribute('aria-orientation', narrow.matches ? 'horizontal' : 'vertical');
  orientation();
  narrow.addEventListener('change', orientation);
  function activate(selected, focus = false) {
    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    }
    if (focus) selected.focus();
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', event => {
      const previous = narrow.matches ? 'ArrowLeft' : 'ArrowUp';
      const next = narrow.matches ? 'ArrowRight' : 'ArrowDown';
      let index = tabs.indexOf(tab);
      if (event.key === next) index = (index + 1) % tabs.length;
      else if (event.key === previous) index = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else return;
      event.preventDefault(); activate(tabs[index], true);
    });
  }
})();
