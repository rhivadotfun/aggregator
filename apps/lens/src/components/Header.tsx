import Link from "next/link";
import Image from "next/image";

import IcLogo from "../assets/ic_logo.png";
import ILLooper from "../assets/il_looper.svg";
import IcTwitter from "../assets/ic_twitter.png";

export default function Header() {
  return (
    <section className="relative bg-white/3 overflow-hidden">
      <header className="flex items-center p-4 z-0 md:px-8 2xl:px-16">
        <Link href="/">
          <Image
            src={IcLogo}
            width={96}
            height={96}
            alt="Rhiva Lens"
          />
        </Link>
        <Link
          href="https://x.com/rhivadotfun"
          target="_blank"
          className="ml-auto"
        >
          <Image
            src={IcTwitter}
            width={16}
            height={16}
            alt="Twitter"
          />
        </Link>
      </header>
      <div className="flex flex-col min-w-4/10 lt-md:items-center md:px-8 2xl:px-16 md:min-h-72 md:justify-center md:space-y-2 md:pb-16">
        <div className="flex flex-row space-x-2 text text-4xl font-bold md:text-6xl 2xl:text-8xl">
          <span>Rhiva</span>
          <span className="text-primary">Lens</span>
        </div>
        <div className="text-base lt-md:text-center">
          An analytics dashboard Built on Saros
          <br className="md:hidden" /> to support&nbsp;
          <span className="text-primary">LP </span>
          <br className="lt-md:hidden" />
          on&nbsp;
          <span className="text-primary">DLMM</span> positions
        </div>
      </div>
      <Image
        className="flex-1 size-full lt-md:mt-8 md:absolute md:right-0 md:top-0 md:w-8/10 md:h-full md:object-fill"
        src={ILLooper}
        width={256}
        height={256}
        alt="Illustration Looper"
      />
    </section>
  );
}
