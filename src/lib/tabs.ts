const LOCK_NAME = "deepwork-tracker-active-tab";

export async function claimPrimaryTab(
  onStatus: (secondary: boolean) => void,
): Promise<() => void> {
  if (typeof navigator === "undefined" || !("locks" in navigator)) {
    return () => {};
  }

  let release: () => void = () => {};
  const block = new Promise<void>((res) => {
    release = res;
  });

  let mine = false;
  void navigator.locks
    .request(LOCK_NAME, async () => {
      mine = true;
      onStatus(false);
      await block;
    })
    .catch(() => {});

  await new Promise((r) => setTimeout(r, 300));
  if (!mine) {
    onStatus(true);
    release();
  }

  return () => {
    release();
  };
}
