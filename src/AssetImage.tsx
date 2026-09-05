import React from 'react';
import {Img, staticFile} from 'remotion';
import {Gif} from '@remotion/gif';

// Every place in this project that shows one of the user's own files from
// public/assets/ (a logo, a reference picture, a character pose) goes
// through here instead of a raw <Img>. Reason: a plain <Img> pointed at an
// animated .gif only ever shows ONE static frame during the real render —
// Chromium's own GIF animation timer runs on a wall-clock, not Remotion's
// frame clock, so whatever frame happens to be showing when headless Chrome
// captures that instant is what you get, every frame, for the whole scene.
// <Gif> (from @remotion/gif) decodes the file itself and seeks to the exact
// frame Remotion's own clock asks for, so an animated gif actually animates,
// frame-accurately, in the final render. Everything else (.png/.jpg/.jpeg/
// .webp/.svg) renders exactly as before, via <Img>.
export const AssetImage: React.FC<{
  filename: string;
  style?: React.CSSProperties;
}> = ({filename, style}) => {
  const src = staticFile(`assets/${filename}`);
  if (filename.toLowerCase().endsWith('.gif')) {
    return <Gif src={src} style={style} fit="contain" />;
  }
  return <Img src={src} style={style} />;
};
