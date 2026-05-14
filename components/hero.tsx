export default function Hero() {
  return (
    <section className="mb-20">
      <div className="mb-8">
        <h1 className="text-5xl md:text-6xl font-bold mb-4 text-pretty">
          Ben Cressman
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed mt-4">
          <strong>Software Engineer</strong> based in Dallas at The Axle Group, building web applications in the financial industry with Next and AWS.
        </p>
        <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed mt-4">
          <b>
            <a
              href="mailto:hello@bencres.dev"
              className="text-blue-600 hover:text-blue-400 transition rounded-md"
            >
              hello@bencres.dev
            </a>
          </b>
        </p>
      </div>
    </section>
  );
}
