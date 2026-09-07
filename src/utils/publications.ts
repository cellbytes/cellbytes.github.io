import type { ImageMetadata } from "astro";
import head from "~src/assets/images/publications/head.jpg";
import icons from "~src/assets/images/publications/icons.jpg";
import neural from "~src/assets/images/publications/neural.jpg";
import pills from "~src/assets/images/publications/pills.jpg";
import type { Accent } from "~src/consts";

export interface Publication {
  title: string;
  /** Full author list, as the journal prints it. */
  authors: string;
  /** Journal and publication date, e.g. "Leukemia / 16 Sep 2025". */
  source: string;
  url: string;
  image: ImageMetadata;
  alt: string;
  accent: Accent;
}

/**
 * The papers the site links out to, newest first.
 *
 * A list rather than a content collection: an entry is a handful of fields and
 * a cover image with no body of its own, and it is read in two places - the
 * full listing on /publications and the two most recent on the research
 * use-case page - which is what it exists to keep in agreement.
 *
 * Accents are assigned per entry rather than cycled, since a paper keeps the
 * cover art it was announced with.
 */
export const PUBLICATIONS: Publication[] = [
  {
    title:
      "Interpretable multi-modal hierarchical framework to support cytomorphological analysis of hematologic cancers",
    authors:
      "Wang J, Tatun M, Purhonen M, Sundquist H, Joutsi-Korhonen L, Siitonen S, Lempiäinen A, Zheng Y, Brück O",
    source: "npj Digital Medicine / 29 Aug 2026",
    url: "https://www.nature.com/articles/s41746-026-03145-9",
    image: icons,
    alt: "Pink and blue 3D circular icons sparkling like glass",
    accent: "support-purple",
  },
  {
    title:
      "Deep cytomorphology identifies erythroid skewing and monocytic morphology to predict TKI sensitivity in CML patients",
    authors:
      "Luukkainen K, Purhonen M, Tatun M, Hung H, Tafjord O, Sundquist H, Söderlund S, Adnan-Awad S, Dohlen A, Heikkinen J, Koskenvesa P, Joutsi-Korhonen L, Lempiäinen A, Siitonen S, Mustjoki S, Shanmuganathan N, Bryce C, Danielsson S, Hjorth-Hansen H, Olsson-Strömberg U, Kumagai T, Kimura S, Ross DM, Brück O",
    source: "HemaSphere / 13 Feb 2026",
    url: "https://onlinelibrary.wiley.com/doi/10.1002/hem3.70319",
    image: head,
    alt: "Stylized 3D illustration of a head outlined by furry lines",
    accent: "bytes-blue",
  },
  {
    title:
      "Granulocyte abundance and maturation state at diagnosis predicts treatment-free remission in CML",
    authors:
      "Purhonen M, Tatun M, Luukkainen K, Hung K, Sundquist H, Tafjord O, Söderlund S, Adnan-Awad S, Dohlen A, Heikkinen J, Koskenvesa P, Siitonen S, Mustjoki S, Shanmuganathan N, Bryce C, Danielsson S, Hjorth-Hansen H, Olsson-Strömberg U, Kumagai T, Kimura S, Ross DM, Brück O",
    source: "Leukemia / 16 Sep 2025",
    url: "https://www.nature.com/articles/s41375-025-02769-2",
    image: pills,
    alt: "3D illustration of a machine outputting streams of data with pills watching along",
    accent: "support-pink",
  },
  {
    title:
      "The multimodality cell segmentation challenge: toward universal solutions",
    authors:
      "Ma J, Xie R, Ayyadhury S, Ge C, Gupta A, Gupta R, Gu S, Zhang Y, Lee G, Kim J, Lou W, Li H, Upschulte E, Dickscheid T, de Almeida JG, Wang Y, Han L, Yang X, Labagnara M, Gligorovski V, Scheder M, Rahi SJ, Kempster C, Pollitt A, Espinosa L, Mignot T, Middeke JM, Eckardt JN, Li W, Li Z, Cai X, Bai B, Greenwald NF, Van Valen D, Weisbart E, Cimini BA, Cheung T, Brück O, Bader GD, Wang B.",
    source: "Nature Methods / 26 Mar 2024",
    url: "https://www.nature.com/articles/s41592-024-02233-6",
    image: neural,
    alt: "3D illustration of a neural network",
    accent: "bytes-purple",
  },
];
