// In-memory data store for backend demo, analytics & message persistence
export const backendStore = {
  pageViews: 1540,
  serverStartTime: Date.now(),
  contactMessages: [
    {
      id: 'msg_1',
      name: 'Emily Davis',
      email: 'emily.davis@techventures.io',
      subject: 'Senior AI Engineer Opportunity',
      message: 'Hi Sachin, we were deeply impressed by your ML and Full-Stack background. Would love to connect for a quick intro call.',
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
      status: 'read',
    },
    {
      id: 'msg_2',
      name: 'Rahul Sharma',
      email: 'rahul.s@cloudscale.dev',
      subject: 'Consulting on Distributed Systems',
      message: 'Hey Sachin! Loved your projects on GitHub. Are you available for contract or consulting work in Q2?',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      status: 'unread',
    },
  ],
};
