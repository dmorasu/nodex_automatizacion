import Image from "next/image";

export default function Logo() {
  return (
    <Image
      src="/nodextramites.png"
      alt="Logo Nodex"
      width={160}
      height={50}
      className="
        w-[130px]
        h-auto
        object-contain
      "
      priority
    />
  );
}