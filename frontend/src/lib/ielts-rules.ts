/**
 * IELTS test rules enforcement.
 *
 * Universal rules (for every module):
 *  - Fullscreen is required
 *  - Tab switching — 3 times → cheating
 *  - Copy/paste/cut blocked
 *  - Right-click context menu blocked
 *  - F12, Ctrl+Shift+I/J/C, Ctrl+U blocked
 *  - Refresh page blocked (beforeunload warning)
 */

export class IELTSEnforcement {
  // ----- Fullscreen -----

  async enterFullscreen() {
    const el = document.documentElement
    if (el.requestFullscreen) {
      try { await el.requestFullscreen() } catch { /* user denied */ }
    }
  }

  exitFullscreen() {
    if (document.fullscreenElement && document.exitFullscreen) {
      try { document.exitFullscreen() } catch { /* ignore */ }
    }
  }

  isFullscreen(): boolean {
    return !!document.fullscreenElement
  }

  onFullscreenChange(cb: () => void): () => void {
    const handler = () => cb()
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }

  // ----- Tab visibility -----

  onTabHide(cb: () => void): () => void {
    const handler = () => {
      if (document.hidden) cb()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }

  // ----- Copy / paste / cut block -----

  blockCopyPaste(element: HTMLElement | Document = document): () => void {
    const block = (e: Event) => e.preventDefault()
    element.addEventListener('copy', block)
    element.addEventListener('paste', block)
    element.addEventListener('cut', block)
    return () => {
      element.removeEventListener('copy', block)
      element.removeEventListener('paste', block)
      element.removeEventListener('cut', block)
    }
  }

  // ----- Context menu (right-click) block -----

  blockContextMenu(): () => void {
    const handler = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', handler)
    return () => document.removeEventListener('contextmenu', handler)
  }

  // ----- DevTools shortcuts block -----

  blockDevTools(): () => void {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F12') { e.preventDefault(); return }
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
        e.preventDefault(); return
      }
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault(); return
      }
      // Ctrl+S — save page
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault(); return
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }

  // ----- Reload (Ctrl+R / F5) block + warning -----

  blockReload(message = 'Reloading will discard your test. Continue?'): () => void {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = message
      return message
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'F5') { e.preventDefault(); return }
      if (e.ctrlKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault(); return
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('keydown', keyHandler)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('keydown', keyHandler)
    }
  }
}

export const ieltsRules = new IELTSEnforcement()
