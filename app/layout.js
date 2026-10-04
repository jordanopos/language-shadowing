import './globals.css';

export const metadata = {
  title: 'Shadow — language practice',
  description: 'Upload a video or audio clip and practice speaking along, one sentence at a time.',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
