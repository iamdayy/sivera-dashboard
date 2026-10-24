// Module-level shared state for dialog stack
let nextDialogId = 0
export const openDialogs: number[] = []

export function useDialogStack() {
  // Per-instance unique ID
  const dialogId = ++nextDialogId

  function pushDialog() {
    openDialogs.push(dialogId)
  }

  function popDialog() {
    const index = openDialogs.lastIndexOf(dialogId)
    if (index !== -1) openDialogs.splice(index, 1)
  }

  function isTopDialog(): boolean {
    return openDialogs[openDialogs.length - 1] === dialogId
  }

  return {
    dialogId,
    pushDialog,
    popDialog,
    isTopDialog,
  }
}