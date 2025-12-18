const sent: Array<{ to: string; subject: string; body: string }> = [];

export function sendEmail(to: string, subject: string, body: string) {
  sent.push({ to, subject, body });
  return { id: `email-${sent.length}` };
}

export function getSentEmails() {
  return [...sent];
}

export function clearEmails() {
  sent.length = 0;
}
