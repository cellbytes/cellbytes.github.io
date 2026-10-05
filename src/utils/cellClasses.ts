/**
 * The sample types the application analyses. Each one has its own label set,
 * so everything below is keyed by it.
 */
export type SampleType = "bone-marrow" | "peripheral-blood";

export interface CellClass {
  name: string;
  /**
   * The application's class name, lowercased. It is also the folder the
   * example crops live in, which is what pairs a class with its gallery.
   */
  key: string;
}

export interface Lineage {
  name: string;
  /**
   * Set when the lineage is itself a single class rather than a grouping, in
   * which case its name is the selectable item and it has no members.
   */
  key?: string;
  /** The color the application paints this lineage's cells with. */
  color: string;
  /** Whether the dysplasia assessment covers this lineage. */
  dysplasia?: boolean;
  members: (CellClass | { name: string; members: CellClass[] })[];
}

export interface DysplasiaRow {
  /**
   * What the row is about: usually a group of cell classes and the features
   * found in it, but a feature common to many groups is worth turning around,
   * so the row is the feature and the captions are the classes.
   */
  label: string;
  /** `key` locates the crop, as `<group>/<feature>`; `name` captions it. */
  items: { name: string; key: string }[];
}

// The lineage colors the application paints cell boxes and differentials with,
// so a reader recognizes the same grouping in the product.
const ERYTHROID = "#f0ae92";
const BLASTS = "#ff4488";
const GRANULOCYTIC = "#afc9f1";
const LYMPHOID = "#b4d295";
const MONOCYTIC = "#fff09c";
const OTHER = "#cccccc";

/** The cell classes reported for each sample type, grouped by lineage. */
export const CELL_CLASSES: Record<SampleType, Lineage[]> = {
  "bone-marrow": [
    {
      name: "Erythroid",
      color: ERYTHROID,
      dysplasia: true,
      members: [
        { name: "Proerythroblast", key: "bm_proerythroblast" },
        { name: "Erythroblast", key: "bm_erythroblast" },
      ],
    },
    {
      name: "Blasts",
      color: BLASTS,
      dysplasia: true,
      members: [
        { name: "Blast", key: "bm_blast" },
        { name: "Promonocyte", key: "bm_promonocyte" },
      ],
    },
    {
      name: "Granulocytic",
      color: GRANULOCYTIC,
      dysplasia: true,
      members: [
        { name: "Promyelocyte", key: "bm_promyelocyte" },
        { name: "Myelocyte", key: "bm_myelocyte" },
        { name: "Metamyelocyte", key: "bm_metamyelocyte" },
        { name: "Neutrophil", key: "bm_neutrophil" },
        { name: "Basophil", key: "bm_basophil" },
        {
          name: "Eosinophils",
          members: [
            { name: "Mature", key: "bm_eosinophil" },
            { name: "Immature", key: "bm_eosinophil_immature" },
          ],
        },
      ],
    },
    {
      name: "Lymphoid",
      color: LYMPHOID,
      dysplasia: true,
      members: [
        { name: "Lymphocyte", key: "bm_lymphocyte" },
        { name: "Plasma cell", key: "bm_plasma_cell" },
      ],
    },
    {
      name: "Monocytic",
      color: MONOCYTIC,
      members: [
        { name: "Monocyte", key: "bm_monocyte" },
        { name: "Macrophage", key: "bm_macrophage" },
      ],
    },
    {
      name: "Other",
      color: OTHER,
      members: [
        { name: "Artefact", key: "bm_artefact" },
        { name: "Megakaryocyte", key: "bm_megakaryocyte" },
      ],
    },
  ],
  "peripheral-blood": [
    {
      name: "Erythroblast",
      key: "pb_erythroblast",
      color: ERYTHROID,
      members: [],
    },
    {
      name: "Blasts",
      color: BLASTS,
      members: [
        { name: "Blast", key: "pb_blast" },
        { name: "Promonocyte", key: "pb_promonocyte" },
      ],
    },
    {
      name: "Granulocytic",
      color: GRANULOCYTIC,
      members: [
        { name: "Promyelocyte", key: "pb_promyelocyte" },
        { name: "Myelocyte", key: "pb_myelocyte" },
        { name: "Metamyelocyte", key: "pb_metamyelocyte" },
        {
          name: "Neutrophil",
          members: [
            { name: "Band", key: "pb_band_neutrophil" },
            { name: "Segmented", key: "pb_segmented_neutrophil" },
          ],
        },
        { name: "Basophil", key: "pb_basophil" },
        { name: "Eosinophils", key: "pb_eosinophil" },
      ],
    },
    {
      name: "Lymphoid",
      color: LYMPHOID,
      members: [
        { name: "Lymphocyte", key: "pb_lymphocyte" },
        { name: "Plasma cell", key: "pb_plasma_cell" },
      ],
    },
    {
      name: "Monocyte",
      key: "pb_monocyte",
      color: MONOCYTIC,
      members: [],
    },
    {
      name: "Artefact",
      key: "pb_artefact",
      color: OTHER,
      members: [],
    },
  ],
};

/**
 * The dysplasia features reported for each group of cell classes, mirroring the
 * dysplasia structure the application assesses. Bone marrow covers two groups
 * that a blood smear does not: erythroblasts and megakaryocytes.
 */
export const DYSPLASIAS: Record<SampleType, DysplasiaRow[]> = {
  "bone-marrow": [
    {
      label: "Blasts / immature granulocytes",
      items: [
        {
          name: "Bilobed nucleus",
          key: "blasts_immature_granulocytes/abnormal_pmy",
        },
        { name: "Auer rods", key: "blasts_immature_granulocytes/auer_rods" },
      ],
    },
    {
      label: "Erythroblasts",
      items: [
        { name: "N:C asynchrony", key: "erythroblasts/nc_asynchrony_nrbc" },
        { name: "Dysmorphic", key: "erythroblasts/dysmorphic_nrbc" },
        { name: "Multinucleated", key: "erythroblasts/multinuclear_nrbc" },
      ],
    },
    {
      label: "Megakaryocytes",
      items: [
        { name: "Separated nuclei", key: "megakaryocytes/separated_mgk" },
        { name: "Hypolobated nuclei", key: "megakaryocytes/hypolobated_mgk" },
      ],
    },
    {
      label: "Vacuolated",
      items: [
        {
          name: "Blasts / immature granulocytes",
          key: "blasts_immature_granulocytes/vacuolated",
        },
        { name: "Erythroblasts", key: "erythroblasts/vacuolated" },
        { name: "Mature granulocytes", key: "mature_granulocytes/vacuolated" },
        { name: "Lymphocytes", key: "lymphocytes/vacuolated" },
        { name: "Plasma cells", key: "plasma_cells/vacuolated" },
      ],
    },
  ],
  "peripheral-blood": [
    {
      label: "Blasts / immature granulocytes",
      items: [
        {
          name: "Bilobed nucleus",
          key: "pb_blasts_immature_granulocytes/abnormal_pmy",
        },
        {
          name: "Auer rods",
          key: "pb_blasts_immature_granulocytes/auer_rods",
        },
      ],
    },
    {
      label: "Vacuolated",
      items: [
        {
          name: "Blasts / immature granulocytes",
          key: "pb_blasts_immature_granulocytes/vacuolated",
        },
        {
          name: "Mature granulocytes",
          key: "pb_mature_granulocytes/vacuolated",
        },
        { name: "Lymphocytes", key: "pb_lymphocytes/vacuolated" },
        { name: "Plasma cells", key: "pb_plasma_cells/vacuolated" },
      ],
    },
  ],
};
