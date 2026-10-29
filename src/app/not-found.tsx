import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <div className="font-mono text-sm text-fg-faint">404</div>
        <h1 className="mt-2 text-2xl font-semibold">This page drifted off the map</h1>
        <p className="mt-2 text-sm text-fg-muted">The link may be broken or the page was moved.</p>
        <Link href="/" className="btn-primary mt-6">
          Back to the live map
        </Link>
      </div>
    </div>
  );
}
