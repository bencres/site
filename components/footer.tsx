export default function Footer() {
  return (
    <footer className="border-t border-border py-8 mt-20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2025 Ben Cressman. Built with NextJS, TypeScript, and Tailwind.
          </p>
        </div>
      </div>
    </footer>
  );
}
