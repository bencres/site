export default function Hero() {
  return (
    <section className="mb-20">
      <div className="mb-8">
        <h1 className="text-5xl md:text-6xl font-bold mb-4 text-pretty">
          Ben Cressman
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">
          <strong>Software engineer</strong> based in{" "}
          <span className="font-semibold">Dallas, Texas</span>.
        </p>
        <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed mt-4">
          Currently a <strong>Pipeline TD</strong> at Pixel Foundry, a <strong>Full-Stack Engineer</strong> for Hytale Modding, and finishing my MFA in Game Development. 
        </p>
        <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed mt-4">
          My expertise is in <span className="font-semibold">Python</span> {" "}
          for game development and visual effects, especially in <span className="font-semibold">Houdini</span>, {" "}
          <span className="font-semibold">Unreal</span>, and <span className="font-semibold">Nuke</span>, {" "}
          <span className="font-semibold">C#</span> for <span className="font-semibold">Unity</span>, {" "}
          and full-stack development with <span className="font-semibold">Typescript</span>, <span className="font-semibold">NextJS</span>, <span className="font-semibold">React</span>, <span className="font-semibold">Tailwind</span>, <span className="font-semibold">nginx</span>, <span className="font-semibold">Redis</span>, <span className="font-semibold">Docker</span>, and <span className="font-semibold">FastAPI</span>.
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
