export async function withSpinner(label: string, fn: () => Promise<any>) {
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let i = 0;
  const write = (s: string) => {
    try {
      process.stderr.write(s);
    } catch (e) {
      // ignore
    }
  };

  const hideCursor = '\x1B[?25l';
  const showCursor = '\x1B[?25h';

  write(hideCursor);
  const id = setInterval(() => {
    write('\r' + label + ' ' + frames[i % frames.length]);
    i++;
  }, 80);

  try {
    const res = await fn();
    clearInterval(id);
    write('\r' + label + ' ✓\n');
    write(showCursor);
    return res;
  } catch (err) {
    clearInterval(id);
    write('\r' + label + ' ✖\n');
    write(showCursor);
    throw err;
  }
}
