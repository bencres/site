export default function Hero() {
  return (
    <section className="mb-20">
      <div className="mb-8">
        <h1 className="text-5xl md:text-6xl font-bold mb-4 text-pretty">
          Ben Cressman
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">
          Technical artist and developer based in Dallas, Texas.
        </p>
        <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed mt-4">
          Expertise in Python, Houdini, Unreal Engine 5, Maya, C#, and Unity.
        </p>
        <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed mt-4">
          Get in touch:{" "}
          <b>
            <a
              href="mailto:ben@utdallas.edu"
              className="text-accent hover:text-accent/80 transition"
            >
              ben@utdallas.edu
            </a>
          </b>
        </p>
      </div>
    </section>
  );
}
