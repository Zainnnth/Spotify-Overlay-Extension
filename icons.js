export function iconSvg(kind) {
  const icons = {
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.7-4.1-9.6-8.1C.1 9.7 1.1 5.9 4.9 4.5 7 3.8 9.4 4.4 11 6.1c1.6-1.7 4-2.3 6.1-1.6 3.8 1.4 4.8 5.2 2.5 8.4C18.7 16.9 12 21 12 21z"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14l10-7-10-7zm11 0h2v14h-2z"/></svg>',
    open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z"/></svg>',
    remove: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6h10l-1 15H8L7 6zm3-3h4l1 2h4v2H5V5h4l1-2zm-1 7h2v7H9v-7zm4 0h2v7h-2v-7z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h2v12H6V6zm3 6 10-6v12L9 12z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7-11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7V5zm6 0h4v14h-4V5z"/></svg>'
  };
  return icons[kind] || icons.play;
}
