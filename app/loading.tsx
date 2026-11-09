import { Loader } from '@/components/Loader';

/** Shown while the server prepares the page. */
export default function Loading() {
  return <Loader label="Opening Spendit…" />;
}
