export default function Hero() {
  return (
    <section className="mb-20">
      <div className="mb-8">
        <h1 className="text-5xl md:text-6xl font-bold mb-4 text-pretty">
          Ben Cressman
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">
          Technical artist and developer based in{" "}
          <span className="font-semibold">Dallas, Texas</span>.
        </p>
        <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed mt-4">
          <span className="font-semibold">Pipeline TD</span> at{" "}
          <span className="font-semibold">Pixel Foundry</span> supporting
          photo-real effects and photogrammetry.
        </p>
        <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed mt-4">
          Expertise in <span className="font-semibold">Python</span>,{" "}
          <span className="font-semibold">Houdini</span>,{" "}
          <span className="font-semibold">Unreal Engine 5</span>,{" "}
          <span className="font-semibold">Nuke</span>,{" "}
          <span className="font-semibold">Maya</span>, their{" "}
          <span className="font-semibold">Python API's</span>,{" "}
          <span className="font-semibold">C#</span>, and{" "}
          <span className="font-semibold">Unity</span>.
        </p>
        <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed mt-4">
          Get in touch:{" "}
          <b>
            <a
              href="mailto:ben@utdallas.edu"
              className="text-blue-600 hover:text-blue-400 transition rounded-md"
            >
              ben@utdallas.edu
            </a>
          </b>
        </p>
      </div>
    </section>
  );
}
