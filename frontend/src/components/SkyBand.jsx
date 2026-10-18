import { CloudBank, Constellation, PaperPlane, Starfield } from "./NightSky";

/** Thin night-sky strip under the navbar so inner pages share the landing page's look. */
export default function SkyBand() {
    return (
        <div className="sky-band" aria-hidden="true">
            <Starfield className="sky-stars" count={70} seed={17} />
            <Constellation
                className="sky-constellation"
                points={[[4, 40], [36, 20], [70, 34], [104, 8], [140, 22]]}
            />
            <PaperPlane className="sky-plane" size={40} />
            <CloudBank className="sky-clouds" seed={23} width={2880} height={260} only={["mid", "front"]} edges={false} />
        </div>
    );
}
