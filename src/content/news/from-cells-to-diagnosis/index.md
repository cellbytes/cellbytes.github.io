---
title: "Article: From Cells to Diagnosis"
description: "Machine learning integrates bone marrow and peripheral blood morphology to support interpretable patient-level cytomorphological diagnosis."
date: 2026-09-01
author: "Junxia Wang"
tags: ["technology", "research"]
image: ./hero.jpg
imageAlt: "Pink and blue 3D render of various circular icons."
---

## Machine Learning Integrates Bone Marrow and Peripheral Blood Morphology to Support Cytomorphological Diagnosis

Cytomorphological analysis of bone marrow aspirate (BMA) and peripheral blood smears (PBS) remains a diagnostic cornerstone in hematology. Although digital microscopy has enabled substantial progress in automated cell detection and classification, patient-level cytomorphological interpretation requires integration of distributed morphological signals across heterogeneous cell populations, specimen types, and clinical contexts. Computational approaches that integrate these signals into patient-level diagnostic predictions remain limited, motivating models that move beyond isolated cellular phenotypes toward integrated cytomorphological assessment.

In recently published study in npj Digital Medicine, an interpretable multimodal multi-instance framework extends computational cytomorphology from cell-level recognition to patient-level disease classification. Using patient-level diagnoses alone, the model integrates BMA and PBS morphology through a clinically motivated hierarchy from malignant status to lineage and specific disease entity.

The study included 45,248 May-Grünwald-Giemsa-stained smears acquired at 100x magnification and collected at the Helsinki University Hospital between 2009 and 2023, comprising 28,096 BMA and 17,152 PBS samples. The cohort encompassed major myeloid, lymphoid, and plasma-cell malignancies, as well as non-malignant conditions across multiple disease phases. Approximately 186 million nucleated cells were detected and encoded into morphological representations using the Cellbytes software.

![Process chart of the research, from cell detection and feature extraction to hematologic disease classification.](./npj_Wang_figure1a.png "Adapted from Wang et al (npj Digital Medicine, 2026)")

Across eight diagnostic categories, the model achieved AUROC values above 0.90 across eight diagnostic categories. The hierarchy-aware architecture provided the greatest benefit in more difficult diagnostic boundaries, improving F1 classification score from 0.86 to 0.91 for non-malignant samples and from 0.77 to 0.84 for myeloproliferative neoplasm.

Importantly, BMA and PBS provided complementary diagnostic information. BMA remained the dominant modality for marrow-centered diseases, while PBS added discriminatory value in lymphoma, MDS, and MPN, supporting the benefit of joint interpretation across both specimen types.

Interpretability analyses showed that model predictions aligned with disease-relevant morphological evidence. Attention concentrated on hallmark cell populations, including blasts in acute leukemia and plasma cells in multiple myeloma, while model confidence decreased progressively as disease-defining cells were removed.

Overall, these findings highlight the potential of combining BMA and PBS morphology with machine learning to support patient-level cytomorphological diagnosis. Further multi-centre validation will be important to establish robustness across clinical settings and imaging platforms before broader clinical translation.

Wang, J., Tatun, M., Purhonen, M. et al. Interpretable multi-modal hierarchical framework to support cytomorphological analysis of hematologic cancers. npj Digit. Med. (2026). <https://doi.org/10.1038/s41746-026-03145-9>
