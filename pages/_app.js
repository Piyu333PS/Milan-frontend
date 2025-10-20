// pages/_app.js
import '../styles/globals.css'; // IMPORTANT: global CSS yahin se import hoti hai

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
