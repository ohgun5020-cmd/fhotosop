import React, { useEffect, useRef, useState } from "react";
import { unzipSync } from "fflate";

import "./styles.css";

import { entrypoints } from "uxp";
import { PanelController } from "./controllers/PanelController.jsx";

const { app, action, core, constants, imaging } = require("photoshop");
const { storage } = require("uxp");

const fs = storage.localFileSystem;
const binaryReadFormat = storage.formats && storage.formats.binary ? storage.formats.binary : "binary";
const binaryWriteFormat = binaryReadFormat;
const PSD_FILE_TYPES = ["psd", "psb"];
const RASTER_FILE_TYPES = ["png", "jpg", "jpeg", "jfif", "gif", "webp", "bmp", "tif", "tiff"];
const STITCH_FILE_TYPES = PSD_FILE_TYPES.concat(RASTER_FILE_TYPES);
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1.5";
const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const AI_MODEL_OPTIONS = [
  {
    id: "openai:gpt-image-1.5",
    provider: "openai",
    model: DEFAULT_OPENAI_IMAGE_MODEL,
    label: "OpenAI",
    detail: "gpt-image-1.5"
  },
  {
    id: "openai:gpt-image-2",
    provider: "openai",
    model: "gpt-image-2",
    label: "OpenAI 2",
    detail: "gpt-image-2"
  },
  {
    id: "gemini:gemini-3.1-flash-image-preview",
    provider: "gemini",
    model: DEFAULT_GEMINI_IMAGE_MODEL,
    label: "Gemini",
    detail: "gemini-3.1-flash-image-preview"
  },
  {
    id: "gemini:gemini-3-pro-image-preview",
    provider: "gemini",
    model: "gemini-3-pro-image-preview",
    label: "Gemini Pro",
    detail: "gemini-3-pro-image-preview"
  },
  {
    id: "gemini:gemini-2.5-flash-image",
    provider: "gemini",
    model: "gemini-2.5-flash-image",
    label: "Gemini Flash",
    detail: "gemini-2.5-flash-image"
  }
];
const IMAGE_UPSCALE_PROMPT = `The Production-Grade Portrait Restoration & Upscaling Prompt (Optimized v1.7)

[ADAPTIVE RESTORATION SYSTEM]

Apply adaptive restoration based on input degradation (blur, compression, noise, low resolution).
Restore only damaged regions while preserving intact areas.
Maintain strict 1:1 consistency with original identity, geometry, and pixel landmarks.
Do not hallucinate or invent unsupported features.

[STRUCTURE, DISTORTION & DYNAMIC RANGE]

Reconstruct motion/defocus/compression blur using physically plausible detail recovery.
Correct wide-angle distortion and restore natural 85mm portrait proportions.
Recover highlight and shadow detail; prevent crushed blacks and blown highlights.
Ensure clean edges with no haloing, ghosting, or edge artifacts.

[DETAIL & ARTIFACT CONTROL]

Restore pores, vellus hair, wrinkles, and iris detail with natural, non-repeating variation.
Remove JPEG artifacts (macroblocking, mosquito noise, ringing, tiling seams).
Enhance clarity using subtle local contrast, not oversharpening.
Preserve smooth skin gradients and natural transitions.

[IDENTITY, CONSISTENCY & PRIORITY]

Preserve exact facial identity, structure, and expression.
Priority: identity -> structure -> detail -> rendering.
Maintain consistent identity, texture, and lighting across outputs.
Avoid any reinterpretation or variation.

[MULTI-SUBJECT & SPATIAL LOGIC]

Maintain distinct identity for each subject; no blending or leakage.
Primary subject in critical focus; others follow natural depth-of-field.
Preserve accurate scale, perspective, and occlusion relationships.

[ANATOMY, LIMBS & SUBJECT CONSISTENCY]

Preserve correct anatomy: hands, fingers, feet, toes, joints, and proportions.
Maintain original pose, posture, and gesture logic.
Preserve sex-linked anatomy and age-consistent features.
Do not beautify, stylize, or alter body/face characteristics.

[CANVAS, CROP & ALIGNMENT]

Preserve the exact input crop, canvas framing, subject position, and silhouette alignment.
Do not add borders, padding, white canvas, background fill, or extra margins.
Keep empty or transparent-looking regions unchanged instead of inventing a new backdrop.
Return the enhanced result in the same composition so it can overlay the original layer.

[MATERIAL, SKIN & BIO-REALISM]

Render realistic skin (pores, oil balance, subsurface scattering).
Maintain natural moisture in eyes and lips with correct specular response.
Preserve fabric, metal, and glass material behavior accurately.
Keep natural asymmetry and anatomical tension.

[RENDERING SYSTEM (OPTICS, LIGHTING, COLOR)]

Simulate Sony A1 + 85mm f1.4 (f/1.6, ISO100).
Sharp focus on eyes with natural falloff; smooth, realistic bokeh.
Consistent lighting direction with softbox-like shaping and ambient occlusion.
Preserve natural skin tones, stable white balance, and smooth tonal gradients.
Maintain original background blur and depth.

[FAILURE PREVENTION & EDGE CASES]

Handle partial faces, occlusions, and extreme angles without incorrect reconstruction.
Do not complete unseen regions or force symmetry.
Ensure stable, repeatable output without random variation.

[NEGATIVE INSTRUCTIONS]

No identity change
No distortion
No beautification
No plastic skin
No oversharpening
No haloing
No HDR artifacts
No pixelation
No ghosting
No compression artifacts
No repeating patterns
No hallucinated features
No unrealistic anatomy
No CGI look
No identity leakage`;
const IMAGE_SKIN_TEXTURE_PROMPT = `Natural Skin Texture Repair & Healthy Skin Restoration

Retouch only skin quality problems while preserving the original person, pose, facial structure, expression, lighting, crop, background, clothing, and all non-skin details.

Improve skin that looks rubbery, waxy, plastic, blurry, smeared, over-smoothed, AI-broken, or artifacted.
Restore believable pores, fine wrinkles, subtle blemishes, skin grain, vellus hair, and natural micro-contrast.
Keep the skin healthy, clean, and realistic without making it look like beauty-filtered plastic.

Reduce harsh artifacts, blotchy patches, compression damage, unnatural texture repetition, broken highlights, and muddy color transitions.
Preserve natural asymmetry, skin tone variation, age-consistent wrinkles, freckles, moles, pores, and realistic oil/specular response.

Do not change identity.
Do not change face shape, body shape, pose, hands, clothing, hair, background, composition, or silhouette.
Do not add makeup, glamorize, beautify, de-age, airbrush, or remove all natural texture.
Do not create porcelain skin, rubber skin, doll skin, CGI skin, or oversharpened texture.

Return the corrected result in the exact same crop, scale, alignment, and framing so it can overlay the original layer.`;
const IMAGE_HAND_REPAIR_PROMPT = `Hand and Finger Anatomy Repair

Repair only hand, finger, fingernail, knuckle, palm, wrist, and joint problems caused by AI artifacts, low resolution, blur, compression, or deformation.
Preserve the original person, pose, gesture, crop, lighting, clothing, background, and silhouette.
Strictly preserve the original image tone, skin color, white balance, exposure, contrast, saturation, shadow color, highlight color, and local lighting.
The repaired hand must look like it was photographed in the same shot, under the same light, with the same camera and color grade.

Restore natural finger count, finger length, finger spacing, knuckles, tendons, palm shape, nail beds, nail edges, skin folds, and realistic hand texture.
Fix warped fingers, melted fingers, duplicated fingers, fused fingers, broken nails, rubbery hands, smeared joints, and impossible anatomy.
Keep the original gesture and hand position. Do not invent a different hand pose.

Use realistic skin detail: pores, creases, fine wrinkles, subtle veins, natural highlights, and age-consistent texture.
Do not beautify, stylize, simplify, over-smooth, or make the hand look plastic.
Do not brighten, darken, recolor, warm up, cool down, add makeup-like color, add orange/red/gray casts, or globally regrade the selected area.

Do not change face, body, clothing, hair, background, camera angle, composition, or identity.
Return the corrected result in the exact same crop, scale, alignment, and framing so it can overlay the original layer.`;
const IMAGE_HAIR_REPAIR_PROMPT = `Hair Detail and Hairline Repair

Repair only hair, hairline, flyaway strands, bangs, beard, eyebrows, eyelashes, and hair-edge artifacts while preserving the original identity, pose, face, body, clothing, lighting, background, crop, and silhouette.
Strictly preserve the original hair color, local tone, white balance, exposure, contrast, saturation, shadow color, highlight color, shine, and lighting direction.
The repaired hair must look like it was photographed in the same shot, under the same light, with the same camera and color grade.

Restore natural hair strand direction, density, clumps, fine flyaway hairs, realistic hairline transitions, scalp visibility where appropriate, and soft edge detail.
Fix AI-broken hair, melted hair, chunky clumps, smeared strands, jagged cutout edges, haloing, missing wisps, over-sharpened hair, and blurry hair texture.
Preserve the original hairstyle, length, parting, color, volume, and lighting direction.

Do not invent a new hairstyle, change hair color, add hair where there should be none, or overfill transparent areas.
Do not brighten, darken, recolor, warm up, cool down, add colored highlights, add gray/green/red casts, or globally regrade the selected area.
Do not change facial identity, face shape, skin, clothing, background, or composition.
Return the corrected result in the exact same crop, scale, alignment, and framing so it can overlay the original layer.`;
const IMAGE_TEXTURE_REPAIR_PROMPT = `General Material and Natural Texture Repair

Repair degraded or AI-broken textures in the selected image area while preserving the original object, crop, lighting, perspective, color, shape, and composition.
This includes artificial materials and natural materials such as fabric, leather, denim, knit, plastic, metal, glass, wood, stone, concrete, paper, grass, leaves, soil, fur, food surfaces, and other visible textures.

Restore believable micro-texture, grain, weave, fibers, surface scratches, pores, roughness, specular highlights, natural variation, and material-specific detail.
Fix smeared texture, rubbery surfaces, waxy rendering, repeating patterns, muddy detail, compression artifacts, blockiness, noisy edges, and AI hallucinated material patches.

Preserve the original material type. Do not turn fabric into plastic, grass into fur, metal into paint, or natural texture into a generic pattern.
Do not change object shape, identity, silhouette, background, lighting direction, perspective, or composition.
Avoid over-sharpening, fake HDR, excessive contrast, tiled repetition, and decorative invented details.

Return the corrected result in the exact same crop, scale, alignment, and framing so it can overlay the original layer.`;
const IMAGE_LOGO_TEXT_PROMPT = `Logo and Text Clarity Restoration

Restore only logos, labels, typography, symbols, icons, printed marks, jersey numbers, product text, packaging text, and small graphic details in the selected area.
Preserve the exact original wording, letter count, letter order, brand mark shape, icon geometry, color, perspective, placement, crop, and lighting.

Sharpen blurred edges, reduce compression artifacts, clean jagged pixels, rebuild broken strokes, restore clean curves, and improve readability while keeping the original design.
Do not invent new words, translate text, change fonts, replace logos, alter brand identity, add decorative effects, or hallucinate unreadable letters.
If text is too damaged to know exactly, preserve the visible shapes and improve edge clarity without guessing new content.

Maintain the original material surface, print distortion, fabric weave, perspective, shadows, highlights, and color grade.
Return the corrected result in the exact same crop, scale, alignment, and framing so it can overlay the original layer.`;
const IMAGE_HARMONIZE_PROMPT = `Composite Harmonize and Integration

Harmonize the selected composite area so multiple layers look like one naturally photographed image.
Preserve every object's unique identity, shape, texture, material, detail, and silhouette while making the overall composite visually coherent.

Match color temperature, exposure, contrast, black point, white point, saturation, local tone, lighting direction, ambient light, shadow color, highlight color, edge softness, atmospheric depth, and contact shadows.
Create or refine natural grounding shadows and contact shading only where needed so cut-out subjects do not look floating.
Reduce pasted-on edges, haloing, mismatched reflections, broken highlights, harsh rim artifacts, and inconsistent glare on skin, metal, glass, plastic, fabric, and other materials.

Protect all logos, typography, labels, jersey numbers, product text, icons, symbols, and printed marks. Do not reinterpret, rewrite, translate, blur, or hallucinate text. Keep brand marks and readable lettering as close to the original as possible while matching the composite.

Prioritize grounding and contact realism. If a cut-out person or object touches a floor, wall, table, grass, fabric, or any surface, refine the local contact shadow, occlusion, bounce light, edge softness, and footing so it feels physically attached to that surface. Do not add large fake shadows away from the contact area.

Preserve material-specific reflections and highlights. Skin should keep natural specular response, metal should keep crisp reflective highlights, glass should keep transparency/refraction cues, plastic should keep its surface sheen, fabric should keep weave and soft light falloff, and wet/glossy materials should not become matte. Harmonize reflection color and intensity without erasing the material's identity.

Do not change identity, pose, object design, logo/text content, clothing, hairstyle, material type, camera angle, crop, layout, or composition.
Do not over-blur, over-sharpen, recolor creatively, add fantasy lighting, add new objects, remove important details, or flatten the subject's unique characteristics.

Return the harmonized result in the exact same crop, scale, alignment, and framing so it can overlay the original composite area.`;
const AI_ACTION_CONFIGS = {
  upscale: {
    id: "upscale",
    label: "업스케일링",
    prompt: IMAGE_UPSCALE_PROMPT,
    layerName: "AI 업스케일링",
    filePrefix: "fhotoshop-upscale",
    placeCommandName: "Place AI Upscaled Image"
  },
  "skin-texture": {
    id: "skin-texture",
    label: "피부 질감 보정",
    prompt: IMAGE_SKIN_TEXTURE_PROMPT,
    layerName: "AI 피부 질감 보정",
    filePrefix: "fhotoshop-skin-texture",
    placeCommandName: "Place AI Skin Texture Repair"
  },
  "hand-repair": {
    id: "hand-repair",
    label: "손/손가락 복구",
    prompt: IMAGE_HAND_REPAIR_PROMPT,
    layerName: "AI 손/손가락 복구",
    filePrefix: "fhotoshop-hand-repair",
    placeCommandName: "Place AI Hand Repair"
  },
  "hair-repair": {
    id: "hair-repair",
    label: "머리카락 보정",
    prompt: IMAGE_HAIR_REPAIR_PROMPT,
    layerName: "AI 머리카락 보정",
    filePrefix: "fhotoshop-hair-repair",
    placeCommandName: "Place AI Hair Repair"
  },
  "texture-repair": {
    id: "texture-repair",
    label: "다양한 질감 복구",
    prompt: IMAGE_TEXTURE_REPAIR_PROMPT,
    layerName: "AI 다양한 질감 복구",
    filePrefix: "fhotoshop-texture-repair",
    placeCommandName: "Place AI Texture Repair"
  },
  "logo-text-sharpen": {
    id: "logo-text-sharpen",
    label: "로고/문자 선명화",
    prompt: IMAGE_LOGO_TEXT_PROMPT,
    layerName: "AI 로고/문자 선명화",
    filePrefix: "fhotoshop-logo-text",
    placeCommandName: "Place AI Logo Text Sharpen"
  },
  harmonize: {
    id: "harmonize",
    label: "하모나이즈",
    prompt: IMAGE_HARMONIZE_PROMPT,
    layerName: "AI 하모나이즈",
    filePrefix: "fhotoshop-harmonize",
    placeCommandName: "Place AI Harmonize",
    captureMode: "document-context",
    clipToSourceLayer: false,
    contextPaddingRatio: 0.28,
    contextPaddingMin: 96
  }
};
const SORT_OPTIONS = [
  { mode: "name-asc", label: "이름순 정렬", shortLabel: "이름순" },
  { mode: "name-desc", label: "이름 역순 정렬", shortLabel: "역순" },
  { mode: "created-asc", label: "파일생성시간 정렬", shortLabel: "생성시간" }
];
const API_KEY_STORAGE_KEYS = {
  gemini: "fhotoshop.geminiApiKey",
  gpt: "fhotoshop.gptApiKey",
  aiModel: "fhotoshop.aiUpscaleModel"
};
const AI_CATEGORIES = [
  {
    id: "category-1",
    label: "이미지 생성/확장",
    actions: [
      { id: "upscale", label: "업스케일링" },
      { id: "skin-texture", label: "피부 질감 보정" },
      { id: "hand-repair", label: "손/손가락 복구" },
      { id: "hair-repair", label: "머리카락 보정" },
      { id: "texture-repair", label: "다양한 질감 복구" },
      { id: "logo-text-sharpen", label: "로고/문자 선명화" },
      { id: "harmonize", label: "하모나이즈" }
    ]
  },
  {
    id: "category-2",
    label: "카테고리 2",
    actions: [
      { id: "long-button-1", label: "롱 버튼 1" },
      { id: "long-button-2", label: "롱 버튼 2" }
    ]
  }
];

function getAiActionConfig(actionId) {
  return AI_ACTION_CONFIGS[actionId] || null;
}

function stripExtension(name) {
  return String(name || "").replace(/\.[^.]+$/, "");
}

function fileExtension(name) {
  const match = String(name || "").match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
}

function isPsdFileName(name) {
  return PSD_FILE_TYPES.indexOf(fileExtension(name)) !== -1;
}

function isSupportedStitchFileName(name) {
  return STITCH_FILE_TYPES.indexOf(fileExtension(name)) !== -1;
}

function isZipFileName(name) {
  return fileExtension(name) === "zip";
}

function getEntryKey(entry) {
  if (!entry) {
    return "";
  }
  return String(entry.nativePath || entry.fullName || entry.fsName || entry.name || "");
}

function getDateTime(source, keys) {
  if (!source) {
    return 0;
  }
  for (const key of keys) {
    const value = source[key];
    if (!value) {
      continue;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.getTime();
    }
  }
  return 0;
}

async function readEntryMetadata(entry) {
  if (!entry || typeof entry.getMetadata !== "function") {
    return null;
  }
  try {
    return await entry.getMetadata();
  } catch (error) {
    return null;
  }
}

function getModifiedTime(entry, metadata) {
  const keys = ["dateModified", "lastModified", "modified", "modificationDate"];
  return getDateTime(metadata, keys) || getDateTime(entry, keys);
}

function getCreatedTime(entry, metadata) {
  const keys = ["dateCreated", "created", "creationDate", "birthtime", "dateAdded"];
  return getDateTime(metadata, keys) || getDateTime(entry, keys) || getModifiedTime(entry, metadata);
}

function formatFileDate(entry, metadata) {
  const rawDate = getModifiedTime(entry, metadata);
  if (!rawDate) {
    return "파일";
  }
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) {
    return "파일";
  }
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit"
  });
}

function alphaIndex(token) {
  let value = 0;
  const upper = token.toUpperCase();
  for (let index = 0; index < upper.length; index += 1) {
    value = value * 26 + (upper.charCodeAt(index) - 64);
  }
  return value;
}

function extractSortToken(name) {
  const base = stripExtension(name);
  const numericMatches = Array.from(base.matchAll(/(?:^|[_\-\s])(\d{1,5})(?=$|[_\-\s])/g));
  if (numericMatches.length > 0) {
    const last = numericMatches[numericMatches.length - 1][1];
    return {
      type: "number",
      value: Number(last),
      label: last
    };
  }

  const letterMatches = Array.from(base.matchAll(/(?:^|[_\-\s])([A-Z]{1,3})(?=$|[_\-\s])/gi));
  if (letterMatches.length > 0) {
    const last = letterMatches[letterMatches.length - 1][1];
    return {
      type: "letter",
      value: alphaIndex(last),
      label: last.toUpperCase()
    };
  }

  return {
    type: "name",
    value: base.toLowerCase(),
    label: "-"
  };
}

function normalizeZipPath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter(part => part && part !== ".")
    .join("/");
}

function getPathFileName(path, fallback) {
  const parts = normalizeZipPath(path).split("/").filter(Boolean);
  return parts[parts.length - 1] || fallback || "file.psd";
}

function isMacResourceZipEntry(path) {
  const normalized = normalizeZipPath(path);
  const parts = normalized.split("/");
  const fileName = parts[parts.length - 1] || "";
  return parts.indexOf("__MACOSX") !== -1 || fileName.indexOf("._") === 0;
}

function sanitizeTemporaryFileName(name, fallback) {
  const originalName = getPathFileName(name, fallback);
  const cleanName = String(originalName || fallback || "file.psd")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/^\.+/, "")
    .trim() || "file.psd";
  const extension = fileExtension(cleanName);
  const suffix = extension ? `.${extension}` : "";
  const stem = suffix ? cleanName.slice(0, -suffix.length) : cleanName;
  const maxLength = 96;
  const trimmedStem = stem.slice(0, Math.max(1, maxLength - suffix.length));
  return `${trimmedStem || "file"}${suffix}`;
}

function makeTemporaryZipFileName(path, batchId, index) {
  const safeName = sanitizeTemporaryFileName(path, `zip-${index + 1}.file`);
  return `fhotoshop-zip-${batchId}-${String(index + 1).padStart(3, "0")}-${safeName}`;
}

async function createTemporaryZipFile(folder, path, bytes, batchId, index) {
  const file = await folder.createFile(makeTemporaryZipFileName(path, batchId, index), { overwrite: true });
  await file.write(bytesToArrayBuffer(bytes), { format: binaryWriteFormat });
  return file;
}

async function createFileItem(entry, index, options = {}) {
  const itemName = options.name || entry.name;
  const metadata = await readEntryMetadata(entry);
  const sortToken = extractSortToken(itemName);
  return {
    id: options.id || `${Date.now()}-${index}-${itemName}`,
    entry,
    fileKey: options.fileKey || getEntryKey(entry),
    name: itemName,
    extension: fileExtension(itemName),
    sourceZipName: options.sourceZipName || "",
    sourcePath: options.sourcePath || "",
    sortToken,
    width: null,
    height: null,
    resolution: null,
    createdTime: getCreatedTime(entry, metadata),
    modifiedTime: getModifiedTime(entry, metadata),
    modifiedLabel: formatFileDate(entry, metadata)
  };
}

async function createFileItemsFromZip(entry, startIndex, onProgress) {
  const zipName = entry && entry.name ? entry.name : "ZIP";
  let archive;
  try {
    const data = await entry.read({ format: binaryReadFormat });
    archive = unzipSync(normalizeBytes(data));
  } catch (error) {
    throw new Error(`${zipName} 압축을 해제하지 못했습니다. ${error && error.message ? error.message : ""}`.trim());
  }

  const imageEntries = Object.keys(archive)
    .map(rawPath => ({
      rawPath,
      path: normalizeZipPath(rawPath)
    }))
    .filter(zipEntry => zipEntry.path && isSupportedStitchFileName(zipEntry.path) && !isMacResourceZipEntry(zipEntry.path))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }));

  if (imageEntries.length === 0) {
    return [];
  }

  const temporaryFolder = await fs.getTemporaryFolder();
  const sourceKey = getEntryKey(entry) || zipName;
  const batchId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const items = [];

  for (let index = 0; index < imageEntries.length; index += 1) {
    const zipEntry = imageEntries[index];
    if (typeof onProgress === "function") {
      onProgress(`${zipName} 압축 해제 중 (${index + 1}/${imageEntries.length})`);
    }
    const file = await createTemporaryZipFile(temporaryFolder, zipEntry.path, archive[zipEntry.rawPath], batchId, index);
    items.push(await createFileItem(file, startIndex + index, {
      name: zipEntry.path,
      fileKey: `${sourceKey}::${zipEntry.path}`,
      sourceZipName: zipName,
      sourcePath: zipEntry.path
    }));
  }

  return items;
}

async function createFileItemsFromEntries(entries, onProgress) {
  const fileItems = [];
  for (const entry of entries.filter(Boolean)) {
    if (isSupportedStitchFileName(entry.name)) {
      fileItems.push(await createFileItem(entry, fileItems.length));
      continue;
    }
    if (isZipFileName(entry.name)) {
      if (typeof onProgress === "function") {
        onProgress(`${entry.name} ZIP 파일을 확인하는 중입니다.`);
      }
      const zipItems = await createFileItemsFromZip(entry, fileItems.length, onProgress);
      fileItems.push(...zipItems);
    }
  }
  return fileItems;
}

function compareItemsByName(a, b) {
  const typeRank = { number: 0, letter: 1, name: 2 };
  const rankA = typeRank[a.sortToken.type] ?? 3;
  const rankB = typeRank[b.sortToken.type] ?? 3;
  if (rankA !== rankB) {
    return rankA - rankB;
  }
  if (a.sortToken.value < b.sortToken.value) {
    return -1;
  }
  if (a.sortToken.value > b.sortToken.value) {
    return 1;
  }
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

function compareItemsByCreatedTime(a, b) {
  const timeA = a.createdTime || a.modifiedTime || 0;
  const timeB = b.createdTime || b.modifiedTime || 0;
  if (timeA !== timeB) {
    return timeA - timeB;
  }
  return compareItemsByName(a, b);
}

function sortItems(items, mode = "name-asc") {
  const sorted = items.slice().sort(mode === "created-asc" ? compareItemsByCreatedTime : compareItemsByName);
  return mode === "name-desc" ? sorted.reverse() : sorted;
}

function getSortOption(mode) {
  return SORT_OPTIONS.find(option => option.mode === mode) || SORT_OPTIONS[0];
}

function readStoredApiKey(key) {
  try {
    if (typeof localStorage === "undefined") {
      return "";
    }
    return localStorage.getItem(key) || "";
  } catch (error) {
    return "";
  }
}

function writeStoredApiKey(key, value) {
  try {
    if (typeof localStorage === "undefined") {
      return false;
    }
    const nextValue = String(value || "").trim();
    if (nextValue) {
      localStorage.setItem(key, nextValue);
    } else {
      localStorage.removeItem(key);
    }
    return true;
  } catch (error) {
    return false;
  }
}

function sanitizeApiKey(value) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .replace(/^['"`]+|['"`]+$/g, "")
    .replace(/[^\x21-\x7E]/g, "")
    .trim();
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function buildImageRequestError(response, fallbackLabel) {
  const detail = await response.text().catch(() => "");
  const compact = compactText(detail);
  return `${fallbackLabel} (${response.status})${compact ? `: ${compact.slice(0, 260)}` : ""}`;
}

function normalizeBytes(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (typeof ArrayBuffer !== "undefined" && typeof ArrayBuffer.isView === "function" && ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset || 0, value.byteLength || 0);
  }
  if (Array.isArray(value)) {
    return new Uint8Array(value);
  }
  return new Uint8Array(0);
}

function encodeBytesToBase64(bytes) {
  const normalized = normalizeBytes(bytes);
  let binary = "";
  const chunkSize = 32768;
  for (let index = 0; index < normalized.length; index += chunkSize) {
    const chunk = normalized.subarray(index, Math.min(normalized.length, index + chunkSize));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function decodeBase64Image(base64Value) {
  const normalized = String(base64Value || "").trim();
  if (!normalized) {
    throw new Error("AI 이미지 데이터가 비어 있습니다.");
  }
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBlob(bytes, mimeType) {
  return new Blob([normalizeBytes(bytes)], {
    type: mimeType || "application/octet-stream"
  });
}

async function blobToBytes(blob) {
  return normalizeBytes(await blob.arrayBuffer());
}

function detectImageMimeType(bytes) {
  const normalized = normalizeBytes(bytes);
  if (
    normalized.length >= 8 &&
    normalized[0] === 137 &&
    normalized[1] === 80 &&
    normalized[2] === 78 &&
    normalized[3] === 71
  ) {
    return "image/png";
  }
  if (normalized.length >= 3 && normalized[0] === 255 && normalized[1] === 216 && normalized[2] === 255) {
    return "image/jpeg";
  }
  if (
    normalized.length >= 12 &&
    normalized[0] === 82 &&
    normalized[1] === 73 &&
    normalized[2] === 70 &&
    normalized[3] === 70 &&
    normalized[8] === 87 &&
    normalized[9] === 69 &&
    normalized[10] === 66 &&
    normalized[11] === 80
  ) {
    return "image/webp";
  }
  if (
    normalized.length >= 6 &&
    normalized[0] === 71 &&
    normalized[1] === 73 &&
    normalized[2] === 70
  ) {
    return "image/gif";
  }
  return "image/png";
}

async function loadImageFromBytes(bytes, mimeType) {
  if (typeof document === "undefined") {
    throw new Error("이미지 크기 보정을 위한 문서 컨텍스트를 찾지 못했습니다.");
  }
  const image = typeof Image === "function" ? new Image() : document.createElement("img");
  const source = `data:${mimeType || detectImageMimeType(bytes)};base64,${encodeBytesToBase64(bytes)}`;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("AI 결과 이미지를 크기 보정용 캔버스에 불러오지 못했습니다."));
    image.src = source;
  });
  return image;
}

async function resizeImageBytesToPng(bytes, width, height) {
  const targetWidth = roundPixel(width);
  const targetHeight = roundPixel(height);
  if (targetWidth <= 0 || targetHeight <= 0) {
    return normalizeBytes(bytes);
  }
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    throw new Error("현재 UXP 환경에서 결과 이미지 크기 보정 캔버스를 만들 수 없습니다.");
  }
  const image = await loadImageFromBytes(bytes, detectImageMimeType(bytes));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext && canvas.getContext("2d");
  if (!context || typeof context.drawImage !== "function") {
    throw new Error("현재 UXP 환경에서 결과 이미지 크기 보정 캔버스를 그릴 수 없습니다.");
  }
  context.clearRect(0, 0, targetWidth, targetHeight);
  context.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in context) {
    context.imageSmoothingQuality = "high";
  }
  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  const blob = await canvasToPngBlob(canvas);
  return blobToBytes(blob);
}

function getAiModelOption(modelId) {
  return AI_MODEL_OPTIONS.find(option => option.id === modelId) || AI_MODEL_OPTIONS[0];
}

function getApiKeyForModelOption(option, gptKey, geminiKey) {
  if (!option) {
    return "";
  }
  return option.provider === "gemini" ? sanitizeApiKey(geminiKey) : sanitizeApiKey(gptKey);
}

function resolveUpscaleProvider(gptKey, geminiKey, modelId) {
  const option = getAiModelOption(modelId);
  const apiKey = getApiKeyForModelOption(option, gptKey, geminiKey);
  if (!apiKey) {
    return null;
  }

  return {
    provider: option.provider,
    label: option.label,
    model: option.model,
    apiKey
  };
}

function pickOpenAiOutputSize(image) {
  const width = image && Number.isFinite(image.width) ? image.width : 1;
  const height = image && Number.isFinite(image.height) ? image.height : 1;
  if (width >= height * 1.08) {
    return "1536x1024";
  }
  if (height >= width * 1.08) {
    return "1024x1536";
  }
  return "1024x1024";
}

function pickGeminiAspectRatio(image) {
  const width = image && Number.isFinite(image.width) ? image.width : 1;
  const height = image && Number.isFinite(image.height) ? image.height : 1;
  const ratio = Math.max(1 / 8, Math.min(8, width / Math.max(1, height)));
  const candidates = [
    { value: "1:1", ratio: 1 },
    { value: "2:3", ratio: 2 / 3 },
    { value: "3:2", ratio: 3 / 2 },
    { value: "3:4", ratio: 3 / 4 },
    { value: "4:3", ratio: 4 / 3 },
    { value: "4:5", ratio: 4 / 5 },
    { value: "5:4", ratio: 5 / 4 },
    { value: "9:16", ratio: 9 / 16 },
    { value: "16:9", ratio: 16 / 9 },
    { value: "21:9", ratio: 21 / 9 }
  ];
  let best = candidates[0];
  let bestDelta = Math.abs(ratio - best.ratio);
  for (let index = 1; index < candidates.length; index += 1) {
    const delta = Math.abs(ratio - candidates[index].ratio);
    if (delta < bestDelta) {
      best = candidates[index];
      bestDelta = delta;
    }
  }
  return best.value;
}

function pickGeminiImageSize(image) {
  const width = image && Number.isFinite(image.width) ? image.width : 0;
  const height = image && Number.isFinite(image.height) ? image.height : 0;
  return Math.max(width, height) >= 1800 ? "4K" : "2K";
}

function moveItem(items, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const next = items.slice();
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function normalizeRect(startX, startY, currentX, currentY) {
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const right = Math.max(startX, currentX);
  const bottom = Math.max(startY, currentY);
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
}

function rectsIntersect(first, second) {
  return first.left <= second.right && first.right >= second.left && first.top <= second.bottom && first.bottom >= second.top;
}

function roundPixel(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.round(number)) : 1;
}

function asArrayBuffer(data) {
  if (data instanceof ArrayBuffer) {
    return data;
  }
  if (data && data.buffer instanceof ArrayBuffer) {
    const start = data.byteOffset || 0;
    const end = start + (data.byteLength || data.length || 0);
    return data.buffer.slice(start, end);
  }
  throw new Error("파일을 바이너리로 읽지 못했습니다.");
}

function readAscii(view, offset, length) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value;
}

function skipPaddedPascalString(view, offset, endOffset) {
  if (offset >= endOffset) {
    return endOffset;
  }
  const length = view.getUint8(offset);
  let nextOffset = offset + 1 + length;
  if ((1 + length) % 2 !== 0) {
    nextOffset += 1;
  }
  return Math.min(nextOffset, endOffset);
}

function parsePsdResolution(view) {
  try {
    let offset = 26;
    if (offset + 4 > view.byteLength) {
      return null;
    }
    const colorModeLength = view.getUint32(offset, false);
    offset += 4 + colorModeLength;
    if (offset + 4 > view.byteLength) {
      return null;
    }
    const imageResourcesLength = view.getUint32(offset, false);
    offset += 4;
    const endOffset = Math.min(view.byteLength, offset + imageResourcesLength);

    while (offset + 12 <= endOffset) {
      const signature = readAscii(view, offset, 4);
      offset += 4;
      if (signature !== "8BIM" && signature !== "8B64") {
        return null;
      }
      const resourceId = view.getUint16(offset, false);
      offset += 2;
      offset = skipPaddedPascalString(view, offset, endOffset);
      if (offset + 4 > endOffset) {
        return null;
      }
      const size = view.getUint32(offset, false);
      offset += 4;
      const dataOffset = offset;
      const nextOffset = offset + size + (size % 2);
      if (resourceId === 1005 && size >= 16 && dataOffset + 4 <= endOffset) {
        const resolution = view.getInt32(dataOffset, false) / 65536;
        return Number.isFinite(resolution) && resolution > 0 ? resolution : null;
      }
      offset = nextOffset;
    }
  } catch (error) {
    return null;
  }
  return null;
}

function parsePsdHeader(data, name) {
  const buffer = asArrayBuffer(data);
  if (buffer.byteLength < 26) {
    throw new Error(`${name} PSD 헤더가 너무 짧습니다.`);
  }
  const view = new DataView(buffer);
  const signature = readAscii(view, 0, 4);
  if (signature !== "8BPS") {
    throw new Error(`${name} 파일 형식이 PSD/PSB가 아닙니다.`);
  }
  const version = view.getUint16(4, false);
  if (version !== 1 && version !== 2) {
    throw new Error(`${name} PSD 버전을 읽을 수 없습니다.`);
  }
  return {
    width: roundPixel(view.getUint32(18, false)),
    height: roundPixel(view.getUint32(14, false)),
    resolution: parsePsdResolution(view) || 72
  };
}

function readUint24LittleEndian(view, offset) {
  return view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
}

function parsePngResolution(view) {
  let offset = 8;
  while (offset + 12 <= view.byteLength) {
    const chunkLength = view.getUint32(offset, false);
    const chunkType = readAscii(view, offset + 4, 4);
    const dataOffset = offset + 8;
    if (dataOffset + chunkLength + 4 > view.byteLength) {
      return null;
    }
    if (chunkType === "pHYs" && chunkLength >= 9) {
      const pixelsPerMeter = view.getUint32(dataOffset, false);
      const unit = view.getUint8(dataOffset + 8);
      if (unit === 1 && pixelsPerMeter > 0) {
        const resolution = pixelsPerMeter * 0.0254;
        return Number.isFinite(resolution) && resolution > 0 ? resolution : null;
      }
    }
    offset = dataOffset + chunkLength + 4;
  }
  return null;
}

function parsePngHeader(data, name) {
  const buffer = asArrayBuffer(data);
  if (buffer.byteLength < 24) {
    throw new Error(`${name} PNG 헤더가 너무 짧습니다.`);
  }
  const view = new DataView(buffer);
  if (
    view.getUint8(0) !== 0x89 ||
    readAscii(view, 1, 3) !== "PNG" ||
    view.getUint8(4) !== 0x0d ||
    view.getUint8(5) !== 0x0a ||
    view.getUint8(6) !== 0x1a ||
    view.getUint8(7) !== 0x0a ||
    readAscii(view, 12, 4) !== "IHDR"
  ) {
    throw new Error(`${name} 파일 형식이 PNG가 아닙니다.`);
  }
  return {
    width: roundPixel(view.getUint32(16, false)),
    height: roundPixel(view.getUint32(20, false)),
    resolution: parsePngResolution(view) || 72
  };
}

function parseGifHeader(data, name) {
  const buffer = asArrayBuffer(data);
  if (buffer.byteLength < 10) {
    throw new Error(`${name} GIF 헤더가 너무 짧습니다.`);
  }
  const view = new DataView(buffer);
  const signature = readAscii(view, 0, 6);
  if (signature !== "GIF87a" && signature !== "GIF89a") {
    throw new Error(`${name} 파일 형식이 GIF가 아닙니다.`);
  }
  return {
    width: roundPixel(view.getUint16(6, true)),
    height: roundPixel(view.getUint16(8, true)),
    resolution: 72
  };
}

function isJpegSofMarker(marker) {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function parseJpegHeader(data, name) {
  const buffer = asArrayBuffer(data);
  if (buffer.byteLength < 4) {
    throw new Error(`${name} JPG 헤더가 너무 짧습니다.`);
  }
  const view = new DataView(buffer);
  if (view.getUint8(0) !== 0xff || view.getUint8(1) !== 0xd8) {
    throw new Error(`${name} 파일 형식이 JPG가 아닙니다.`);
  }

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < view.byteLength && view.getUint8(offset) === 0xff) {
      offset += 1;
    }
    if (offset >= view.byteLength) {
      break;
    }
    const marker = view.getUint8(offset);
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      continue;
    }
    if (offset + 2 > view.byteLength) {
      break;
    }
    const segmentLength = view.getUint16(offset, false);
    if (segmentLength < 2 || offset + segmentLength > view.byteLength) {
      break;
    }
    const segmentOffset = offset + 2;
    if (isJpegSofMarker(marker) && segmentOffset + 5 <= view.byteLength) {
      return {
        width: roundPixel(view.getUint16(segmentOffset + 3, false)),
        height: roundPixel(view.getUint16(segmentOffset + 1, false)),
        resolution: 72
      };
    }
    offset += segmentLength;
  }

  throw new Error(`${name} JPG 크기 정보를 찾지 못했습니다.`);
}

function parseWebpHeader(data, name) {
  const buffer = asArrayBuffer(data);
  if (buffer.byteLength < 20) {
    throw new Error(`${name} WebP 헤더가 너무 짧습니다.`);
  }
  const view = new DataView(buffer);
  if (readAscii(view, 0, 4) !== "RIFF" || readAscii(view, 8, 4) !== "WEBP") {
    throw new Error(`${name} 파일 형식이 WebP가 아닙니다.`);
  }

  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const chunkType = readAscii(view, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;
    if (dataOffset + chunkSize > view.byteLength) {
      break;
    }

    if (chunkType === "VP8X" && chunkSize >= 10) {
      return {
        width: roundPixel(readUint24LittleEndian(view, dataOffset + 4) + 1),
        height: roundPixel(readUint24LittleEndian(view, dataOffset + 7) + 1),
        resolution: 72
      };
    }

    if (chunkType === "VP8L" && chunkSize >= 5 && view.getUint8(dataOffset) === 0x2f) {
      const b0 = view.getUint8(dataOffset + 1);
      const b1 = view.getUint8(dataOffset + 2);
      const b2 = view.getUint8(dataOffset + 3);
      const b3 = view.getUint8(dataOffset + 4);
      return {
        width: roundPixel((((b1 & 0x3f) << 8) | b0) + 1),
        height: roundPixel((((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) + 1),
        resolution: 72
      };
    }

    if (
      chunkType === "VP8 " &&
      chunkSize >= 10 &&
      view.getUint8(dataOffset + 3) === 0x9d &&
      view.getUint8(dataOffset + 4) === 0x01 &&
      view.getUint8(dataOffset + 5) === 0x2a
    ) {
      return {
        width: roundPixel(view.getUint16(dataOffset + 6, true) & 0x3fff),
        height: roundPixel(view.getUint16(dataOffset + 8, true) & 0x3fff),
        resolution: 72
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  throw new Error(`${name} WebP 크기 정보를 찾지 못했습니다.`);
}

function parseBmpHeader(data, name) {
  const buffer = asArrayBuffer(data);
  if (buffer.byteLength < 26) {
    throw new Error(`${name} BMP 헤더가 너무 짧습니다.`);
  }
  const view = new DataView(buffer);
  if (readAscii(view, 0, 2) !== "BM") {
    throw new Error(`${name} 파일 형식이 BMP가 아닙니다.`);
  }

  const dibSize = view.getUint32(14, true);
  if (dibSize === 12 && buffer.byteLength >= 24) {
    return {
      width: roundPixel(view.getUint16(18, true)),
      height: roundPixel(view.getUint16(20, true)),
      resolution: 72
    };
  }

  return {
    width: roundPixel(Math.abs(view.getInt32(18, true))),
    height: roundPixel(Math.abs(view.getInt32(22, true))),
    resolution: 72
  };
}

function getTiffTypeSize(type) {
  const sizes = {
    1: 1,
    2: 1,
    3: 2,
    4: 4,
    5: 8,
    6: 1,
    7: 1,
    8: 2,
    9: 4,
    10: 8,
    11: 4,
    12: 8
  };
  return sizes[type] || 0;
}

function readTiffScalar(view, entryOffset, littleEndian) {
  const type = view.getUint16(entryOffset + 2, littleEndian);
  const count = view.getUint32(entryOffset + 4, littleEndian);
  const typeSize = getTiffTypeSize(type);
  if (!typeSize || count < 1) {
    return null;
  }
  const byteLength = typeSize * count;
  const valueOffset = byteLength <= 4 ? entryOffset + 8 : view.getUint32(entryOffset + 8, littleEndian);
  if (valueOffset < 0 || valueOffset + typeSize > view.byteLength) {
    return null;
  }

  if (type === 3) {
    return view.getUint16(valueOffset, littleEndian);
  }
  if (type === 4) {
    return view.getUint32(valueOffset, littleEndian);
  }
  if (type === 8) {
    return view.getInt16(valueOffset, littleEndian);
  }
  if (type === 9) {
    return view.getInt32(valueOffset, littleEndian);
  }
  if (type === 5 || type === 10) {
    if (valueOffset + 8 > view.byteLength) {
      return null;
    }
    const numerator = type === 10 ? view.getInt32(valueOffset, littleEndian) : view.getUint32(valueOffset, littleEndian);
    const denominator = type === 10 ? view.getInt32(valueOffset + 4, littleEndian) : view.getUint32(valueOffset + 4, littleEndian);
    return denominator ? numerator / denominator : null;
  }
  return view.getUint8(valueOffset);
}

function parseTiffHeader(data, name) {
  const buffer = asArrayBuffer(data);
  if (buffer.byteLength < 8) {
    throw new Error(`${name} TIFF 헤더가 너무 짧습니다.`);
  }
  const view = new DataView(buffer);
  const byteOrder = readAscii(view, 0, 2);
  const littleEndian = byteOrder === "II";
  if (!littleEndian && byteOrder !== "MM") {
    throw new Error(`${name} 파일 형식이 TIFF가 아닙니다.`);
  }
  const magic = view.getUint16(2, littleEndian);
  if (magic !== 42) {
    throw new Error(`${name} TIFF 형식을 읽을 수 없습니다.`);
  }

  const ifdOffset = view.getUint32(4, littleEndian);
  if (ifdOffset + 2 > view.byteLength) {
    throw new Error(`${name} TIFF 크기 정보를 찾지 못했습니다.`);
  }
  const entryCount = view.getUint16(ifdOffset, littleEndian);
  let width = null;
  let height = null;
  let resolution = null;

  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (entryOffset + 12 > view.byteLength) {
      break;
    }
    const tag = view.getUint16(entryOffset, littleEndian);
    const value = readTiffScalar(view, entryOffset, littleEndian);
    if (tag === 256) {
      width = value;
    } else if (tag === 257) {
      height = value;
    } else if (tag === 282) {
      resolution = value;
    }
  }

  if (!width || !height) {
    throw new Error(`${name} TIFF 크기 정보를 찾지 못했습니다.`);
  }
  return {
    width: roundPixel(width),
    height: roundPixel(height),
    resolution: Number.isFinite(resolution) && resolution > 0 ? resolution : 72
  };
}

function parseFileHeader(data, name, extension) {
  if (isPsdFileName(name) || PSD_FILE_TYPES.indexOf(extension) !== -1) {
    return parsePsdHeader(data, name);
  }
  if (extension === "png") {
    return parsePngHeader(data, name);
  }
  if (extension === "gif") {
    return parseGifHeader(data, name);
  }
  if (extension === "jpg" || extension === "jpeg" || extension === "jfif") {
    return parseJpegHeader(data, name);
  }
  if (extension === "webp") {
    return parseWebpHeader(data, name);
  }
  if (extension === "bmp") {
    return parseBmpHeader(data, name);
  }
  if (extension === "tif" || extension === "tiff") {
    return parseTiffHeader(data, name);
  }
  throw new Error(`${name} 파일 형식은 아직 합치기에 지원되지 않습니다.`);
}

async function readFileMetric(item) {
  const data = await item.entry.read({ format: binaryReadFormat });
  const extension = item.extension || fileExtension(item.name);
  const header = parseFileHeader(data, item.name, extension);
  return {
    id: item.id,
    item,
    width: header.width,
    height: header.height,
    resolution: header.resolution
  };
}

function getTopLevelLayers(doc) {
  return Array.from(doc.layers || []);
}

async function resizeCanvas(doc, width, height) {
  if (!doc || !doc.resizeCanvas) {
    return;
  }
  const anchor = constants && constants.AnchorPosition ? constants.AnchorPosition.TOPLEFT : undefined;
  await doc.resizeCanvas(roundPixel(width), roundPixel(height), anchor);
}

async function groupDocumentLayers(doc, name) {
  const layers = getTopLevelLayers(doc);
  if (layers.length === 0) {
    return null;
  }
  if (layers.length === 1) {
    layers[0].name = name;
    return layers[0];
  }
  try {
    const group = await doc.groupLayers(layers);
    if (group) {
      group.name = name;
    }
    return group;
  } catch (error) {
    console.warn("Could not group layers.", error);
    for (const layer of layers) {
      try {
        layer.name = `${name} / ${layer.name}`;
      } catch (renameError) {
      }
    }
  }
  return null;
}

function renameLayers(layers, prefix) {
  layers.forEach((layer, index) => {
    try {
      layer.name = layers.length === 1 ? prefix : `${prefix} / ${String(index + 1).padStart(2, "0")} ${layer.name}`;
    } catch (error) {
    }
  });
}

async function translateLayers(layers, offsetY) {
  if (!offsetY) {
    return;
  }
  for (const layer of layers) {
    try {
      await layer.translate(0, offsetY);
    } catch (error) {
      console.warn("Could not translate layer.", error);
    }
  }
}

async function closeWithoutSaving(doc) {
  if (!doc || !doc.close) {
    return;
  }
  const options = constants && constants.SaveOptions;
  try {
    await doc.close(options ? options.DONOTSAVECHANGES : undefined);
  } catch (error) {
    try {
      await doc.close();
    } catch (closeError) {
      console.warn("Could not close source document.", closeError);
    }
  }
}

function segmentGroupName(item, index) {
  const number = String(index + 1).padStart(2, "0");
  return `${number} ${stripExtension(item.name)}`;
}

function smartObjectLayerName(item) {
  return stripExtension(item.name);
}

function assertBatchPlayResult(result, message) {
  const errorResult = Array.isArray(result) ? result.find(item => item && item._obj === "error") : null;
  if (errorResult) {
    throw new Error(`${message}: ${errorResult.message || errorResult.result || "Photoshop 명령 실패"}`);
  }
}

function createRenameActiveLayerCommand(name) {
  return {
    _obj: "set",
    _target: [
      {
        _ref: "layer",
        _enum: "ordinal",
        _value: "targetEnum"
      }
    ],
    to: {
      _obj: "layer",
      name
    }
  };
}

function createSetActiveLayerBlendModeCommand(blendMode) {
  return {
    _obj: "set",
    _target: [
      {
        _ref: "layer",
        _enum: "ordinal",
        _value: "targetEnum"
      }
    ],
    to: {
      _obj: "layer",
      mode: {
        _enum: "blendMode",
        _value: blendMode
      }
    },
    _options: {
      dialogOptions: "dontDisplay"
    }
  };
}

function createConvertSmartObjectToLayersCommand() {
  return {
    _obj: "placedLayerConvertToLayers",
    _options: {
      dialogOptions: "dontDisplay"
    }
  };
}

function createClippingMaskCommand() {
  return {
    _obj: "groupEvent",
    _target: [
      {
        _ref: "layer",
        _enum: "ordinal",
        _value: "targetEnum"
      }
    ],
    _options: {
      dialogOptions: "dontDisplay"
    }
  };
}

function createPlaceEmbeddedSmartObjectCommand(metric, canvas) {
  const token = fs.createSessionToken(metric.item.entry);
  const x = Math.round(Number(metric.offsetX) || 0);
  const y = Math.round(Number(metric.offsetY) || 0);
  const horizontalOffset = Math.round(x + metric.width / 2 - canvas.width / 2);
  const verticalOffset = Math.round(y + metric.height / 2 - canvas.height / 2);

  return {
    _obj: "placeEvent",
    "null": {
      _path: token,
      _kind: "local"
    },
    freeTransformCenterState: {
      _enum: "quadCenterState",
      _value: "QCSAverage"
    },
    offset: {
      _obj: "offset",
      horizontal: {
        _unit: "pixelsUnit",
        _value: horizontalOffset
      },
      vertical: {
        _unit: "pixelsUnit",
        _value: verticalOffset
      }
    },
    _isCommand: false,
    _options: {
      dialogOptions: "dontDisplay"
    }
  };
}

function bytesToArrayBuffer(bytes) {
  const normalized = normalizeBytes(bytes);
  return normalized.buffer.slice(normalized.byteOffset || 0, (normalized.byteOffset || 0) + normalized.byteLength);
}

function createPlaceEmbeddedFileCommand(file, placement) {
  const token = fs.createSessionToken(file);
  const command = {
    _obj: "placeEvent",
    "null": {
      _path: token,
      _kind: "local"
    },
    freeTransformCenterState: {
      _enum: "quadCenterState",
      _value: "QCSAverage"
    },
    _isCommand: false,
    _options: {
      dialogOptions: "dontDisplay"
    }
  };
  if (placement && placement.canvas && placement.bounds) {
    const bounds = placement.bounds;
    const canvas = placement.canvas;
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    command.offset = {
      _obj: "offset",
      horizontal: {
        _unit: "pixelsUnit",
        _value: Math.round(centerX - canvas.width / 2)
      },
      vertical: {
        _unit: "pixelsUnit",
        _value: Math.round(centerY - canvas.height / 2)
      }
    };
    if (
      placement.image &&
      Number.isFinite(Number(placement.image.width)) &&
      Number.isFinite(Number(placement.image.height)) &&
      Number(placement.image.width) > 0 &&
      Number(placement.image.height) > 0
    ) {
      command.width = {
        _unit: "percentUnit",
        _value: (bounds.width / Number(placement.image.width)) * 100
      };
      command.height = {
        _unit: "percentUnit",
        _value: (bounds.height / Number(placement.image.height)) * 100
      };
    }
  }
  return command;
}

function clamp8Bit(value, componentSize) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  if (componentSize === 32) {
    return Math.max(0, Math.min(255, Math.round(number * 255)));
  }
  if (componentSize === 16) {
    return Math.max(0, Math.min(255, Math.round(number / 128.5)));
  }
  return Math.max(0, Math.min(255, Math.round(number)));
}

async function canvasToPngBlob(canvas) {
  if (!canvas) {
    throw new Error("PNG로 변환할 캔버스를 만들지 못했습니다.");
  }
  if (typeof canvas.toBlob === "function") {
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(nextBlob => {
        if (!nextBlob) {
          reject(new Error("PNG 변환 결과가 비어 있습니다."));
          return;
        }
        resolve(nextBlob);
      }, "image/png", 1);
    });
    if (blob) {
      return blob;
    }
  }

  if (typeof canvas.toDataURL !== "function") {
    throw new Error("현재 UXP 환경에서 캔버스 PNG 변환을 지원하지 않습니다.");
  }
  const dataUrl = String(canvas.toDataURL("image/png") || "");
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    throw new Error("PNG 데이터 URL을 만들지 못했습니다.");
  }
  return bytesToBlob(decodeBase64Image(dataUrl.slice(commaIndex + 1)), "image/png");
}

function createCanvasPixelOutput(context, width, height) {
  if (context && typeof context.createImageData === "function") {
    return context.createImageData(width, height);
  }
  if (typeof ImageData === "function") {
    return new ImageData(new Uint8ClampedArray(width * height * 4), width, height);
  }
  if (context && typeof context.getImageData === "function") {
    return context.getImageData(0, 0, width, height);
  }
  throw new Error("현재 UXP 캔버스에서 이미지 픽셀 버퍼를 만들지 못했습니다.");
}

function putCanvasPixelOutput(context, output) {
  if (!context || typeof context.putImageData !== "function") {
    throw new Error("현재 UXP 캔버스에서 이미지 픽셀을 그리지 못했습니다.");
  }
  context.putImageData(output, 0, 0);
}

function getLayerDisplayName(layer) {
  if (!layer || typeof layer.name !== "string" || !layer.name.trim()) {
    return "선택 레이어";
  }
  return layer.name.trim();
}

function readBoundsNumber(value) {
  if (value && typeof value === "object") {
    if (Number.isFinite(Number(value.value))) {
      return Number(value.value);
    }
    if (Number.isFinite(Number(value._value))) {
      return Number(value._value);
    }
  }
  return Number(value);
}

function normalizeBounds(bounds) {
  if (!bounds || typeof bounds !== "object") {
    return null;
  }

  const left = readBoundsNumber(bounds.left);
  const top = readBoundsNumber(bounds.top);
  const right = readBoundsNumber(bounds.right);
  const bottom = readBoundsNumber(bounds.bottom);
  const width = readBoundsNumber(bounds.width);
  const height = readBoundsNumber(bounds.height);

  if (Number.isFinite(left) && Number.isFinite(top) && Number.isFinite(right) && Number.isFinite(bottom)) {
    return {
      left: Math.floor(left),
      top: Math.floor(top),
      right: Math.ceil(right),
      bottom: Math.ceil(bottom),
      width: roundPixel(right - left),
      height: roundPixel(bottom - top)
    };
  }

  if (Number.isFinite(left) && Number.isFinite(top) && Number.isFinite(width) && Number.isFinite(height)) {
    return {
      left: Math.floor(left),
      top: Math.floor(top),
      right: Math.ceil(left + width),
      bottom: Math.ceil(top + height),
      width: roundPixel(width),
      height: roundPixel(height)
    };
  }

  return null;
}

function boundsToSourceBounds(bounds) {
  return {
    left: bounds.left,
    top: bounds.top,
    right: bounds.right,
    bottom: bounds.bottom
  };
}

function getActiveLayers(doc) {
  const sourceLayers = doc && doc.activeLayers ? doc.activeLayers : [];
  const layers = Array.isArray(sourceLayers)
    ? sourceLayers.filter(Boolean)
    : Array.from(sourceLayers || []).filter(Boolean);
  if (layers.length === 0 && doc && doc.activeLayer) {
    layers.push(doc.activeLayer);
  }
  return layers;
}

function getSelectedLayerForUpscale(doc) {
  const layers = getActiveLayers(doc);
  if (layers.length === 0) {
    throw new Error("업스케일링할 레이어를 먼저 선택해주세요.");
  }
  return layers[0];
}

function getLayerPixelBounds(layer) {
  const bounds = normalizeBounds(layer && (layer.boundsNoEffects || layer.bounds));
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    throw new Error(`${getLayerDisplayName(layer)} 레이어에서 픽셀 영역을 찾지 못했습니다.`);
  }
  return bounds;
}

function getFirstActiveLayer(doc) {
  const activeLayers = doc && doc.activeLayers ? doc.activeLayers : [];
  const layers = Array.isArray(activeLayers)
    ? activeLayers.filter(Boolean)
    : Array.from(activeLayers || []).filter(Boolean);
  if (layers.length > 0) {
    return layers[0];
  }
  return doc && doc.activeLayer ? doc.activeLayer : null;
}

function canUseLayerBounds(bounds) {
  return Boolean(bounds && bounds.width > 0 && bounds.height > 0);
}

function getLayerBoundsForTransform(layer) {
  return normalizeBounds(layer && (layer.boundsNoEffects || layer.bounds));
}

function getUsableLayerBounds(layers) {
  return (Array.isArray(layers) ? layers : [])
    .map(layer => getLayerBoundsForTransform(layer))
    .filter(canUseLayerBounds);
}

function getDocumentCanvasBounds(doc) {
  const width = roundPixel(doc && doc.width);
  const height = roundPixel(doc && doc.height);
  if (width <= 0 || height <= 0) {
    return null;
  }
  return {
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height
  };
}

function unionBounds(boundsList) {
  const normalizedBounds = (Array.isArray(boundsList) ? boundsList : [])
    .map(normalizeBounds)
    .filter(canUseLayerBounds);
  if (normalizedBounds.length === 0) {
    return null;
  }
  return normalizeBounds({
    left: Math.min(...normalizedBounds.map(bounds => bounds.left)),
    top: Math.min(...normalizedBounds.map(bounds => bounds.top)),
    right: Math.max(...normalizedBounds.map(bounds => bounds.right)),
    bottom: Math.max(...normalizedBounds.map(bounds => bounds.bottom))
  });
}

function intersectBounds(firstBounds, secondBounds) {
  const first = normalizeBounds(firstBounds);
  const second = normalizeBounds(secondBounds);
  if (!canUseLayerBounds(first) || !canUseLayerBounds(second)) {
    return null;
  }
  const left = Math.max(first.left, second.left);
  const top = Math.max(first.top, second.top);
  const right = Math.min(first.right, second.right);
  const bottom = Math.min(first.bottom, second.bottom);
  if (right <= left || bottom <= top) {
    return null;
  }
  return normalizeBounds({ left, top, right, bottom });
}

function expandBoundsWithinCanvas(bounds, canvasBounds, ratio = 0.2, minimumPadding = 64) {
  const source = normalizeBounds(bounds);
  const canvas = normalizeBounds(canvasBounds);
  if (!canUseLayerBounds(source) || !canUseLayerBounds(canvas)) {
    return source;
  }
  const padX = Math.max(Number(minimumPadding) || 0, source.width * (Number(ratio) || 0));
  const padY = Math.max(Number(minimumPadding) || 0, source.height * (Number(ratio) || 0));
  return normalizeBounds({
    left: Math.max(canvas.left, source.left - padX),
    top: Math.max(canvas.top, source.top - padY),
    right: Math.min(canvas.right, source.right + padX),
    bottom: Math.min(canvas.bottom, source.bottom + padY)
  });
}

function selectionDescriptorToBounds(selection) {
  if (!selection || typeof selection !== "object") {
    return null;
  }
  return normalizeBounds(selection.bounds || selection);
}

async function getActiveSelectionBounds(doc) {
  if (!doc) {
    return null;
  }

  try {
    const selection = doc.selection;
    if (selection) {
      const boundsValue = selection.bounds;
      const bounds = selectionDescriptorToBounds(
        boundsValue && typeof boundsValue.then === "function" ? await boundsValue : boundsValue
      );
      if (canUseLayerBounds(bounds)) {
        return bounds;
      }
    }
  } catch (error) {
  }

  try {
    const result = await action.batchPlay(
      [
        {
          _obj: "get",
          _target: [
            { _property: "selection" },
            Number.isFinite(Number(doc.id))
              ? { _ref: "document", _id: doc.id }
              : { _ref: "document", _enum: "ordinal", _value: "targetEnum" }
          ],
          _options: {
            dialogOptions: "dontDisplay"
          }
        }
      ],
      {
        synchronousExecution: false,
        modalBehavior: "fail"
      }
    );
    const bounds = selectionDescriptorToBounds(result && result[0] && result[0].selection);
    return canUseLayerBounds(bounds) ? bounds : null;
  } catch (error) {
    return null;
  }
}

async function translateLayerToBounds(layer, targetBounds) {
  if (!layer || typeof layer.translate !== "function" || !canUseLayerBounds(targetBounds)) {
    return;
  }
  const currentBounds = getLayerBoundsForTransform(layer);
  if (!canUseLayerBounds(currentBounds)) {
    return;
  }
  const dx = targetBounds.left - currentBounds.left;
  const dy = targetBounds.top - currentBounds.top;
  if (Math.abs(dx) >= 0.25 || Math.abs(dy) >= 0.25) {
    await layer.translate(dx, dy);
  }
}

async function fitLayerToBounds(layer, targetBounds) {
  const target = normalizeBounds(targetBounds);
  if (!layer || !canUseLayerBounds(target)) {
    return;
  }

  await translateLayerToBounds(layer, target);

  const currentBounds = getLayerBoundsForTransform(layer);
  if (!canUseLayerBounds(currentBounds) || typeof layer.scale !== "function") {
    return;
  }

  const scaleX = (target.width / currentBounds.width) * 100;
  const scaleY = (target.height / currentBounds.height) * 100;
  if (
    Number.isFinite(scaleX) &&
    Number.isFinite(scaleY) &&
    scaleX > 0 &&
    scaleY > 0 &&
    (Math.abs(scaleX - 100) >= 0.1 || Math.abs(scaleY - 100) >= 0.1)
  ) {
    const anchor = constants && constants.AnchorPosition ? constants.AnchorPosition.TOPLEFT : undefined;
    await layer.scale(scaleX, scaleY, anchor);
  }

  await translateLayerToBounds(layer, target);
}

async function createActiveLayerClippingMask() {
  try {
    const result = await action.batchPlay([createClippingMaskCommand()], { synchronousExecution: false });
    assertBatchPlayResult(result, "원본 실루엣 클리핑 실패");
  } catch (error) {
    console.warn("Could not clip AI result to the source layer.", error);
  }
}

async function captureSelectedLayerPng(doc, layer, actionConfig) {
  const config = actionConfig || AI_ACTION_CONFIGS.upscale;
  if (!doc) {
    throw new Error("업스케일링할 포토샵 문서를 먼저 열어주세요.");
  }
  if (!layer || !Number.isFinite(Number(layer.id))) {
    throw new Error("선택된 레이어 ID를 읽지 못했습니다.");
  }
  if (!imaging || typeof imaging.getPixels !== "function") {
    throw new Error("현재 Photoshop UXP에서 이미지 캡처 API를 찾지 못했습니다.");
  }

  const layerBounds = getLayerPixelBounds(layer);
  const selectionBounds = await getActiveSelectionBounds(doc);
  const canvasBounds = getDocumentCanvasBounds(doc);
  const useDocumentContext = config.captureMode === "document-context";
  const activeLayerBounds = useDocumentContext ? getUsableLayerBounds(getActiveLayers(doc)) : [];
  const compositeTargetBounds = unionBounds(activeLayerBounds) || layerBounds;
  if (useDocumentContext && !selectionBounds && activeLayerBounds.length < 2) {
    throw new Error("하모나이즈는 2개 이상의 레이어를 선택하거나 사각 선택 영역을 지정해주세요.");
  }
  const contextBounds = useDocumentContext
    ? (
      selectionBounds ||
      expandBoundsWithinCanvas(
        compositeTargetBounds,
        canvasBounds,
        config.contextPaddingRatio,
        config.contextPaddingMin
      )
    )
    : null;
  const bounds = useDocumentContext
    ? (intersectBounds(contextBounds, canvasBounds) || contextBounds)
    : (selectionBounds ? intersectBounds(layerBounds, selectionBounds) : layerBounds);
  if (selectionBounds && !bounds) {
    throw new Error("현재 선택 영역과 선택 레이어가 겹치지 않습니다.");
  }
  let pixelCapture = null;
  await core.executeAsModal(async () => {
    const pixelRequest = {
      documentID: doc.id,
      sourceBounds: boundsToSourceBounds(bounds),
      colorSpace: "RGB",
      colorProfile: "sRGB IEC61966-2.1",
      componentSize: 8,
      applyAlpha: true
    };
    if (!useDocumentContext) {
      pixelRequest.layerID = layer.id;
    }
    const result = await imaging.getPixels(pixelRequest);

    const imageData = result && result.imageData;
    if (!imageData) {
      throw new Error("선택 레이어에서 이미지 픽셀을 가져오지 못했습니다.");
    }

    try {
      if (typeof imaging.encodeImageData !== "function") {
        throw new Error("현재 Photoshop UXP에서 이미지 인코딩 API를 찾지 못했습니다.");
      }
      const encodedImage = await imaging.encodeImageData({
        imageData,
        base64: true
      });
      if (typeof encodedImage !== "string" || !encodedImage.trim()) {
        throw new Error("선택 레이어를 API 입력 이미지로 인코딩하지 못했습니다.");
      }
      pixelCapture = {
        width: roundPixel(imageData.width),
        height: roundPixel(imageData.height),
        base64: encodedImage.trim(),
        bounds: normalizeBounds(result && result.sourceBounds) || bounds
      };
    } finally {
      if (imageData && typeof imageData.dispose === "function") {
        imageData.dispose();
      }
    }
  }, {
    commandName: "Capture Selected Layer for AI Upscale",
    interactive: false
  });

  if (!pixelCapture || !pixelCapture.base64) {
    throw new Error("선택 레이어 캡처 결과가 비어 있습니다.");
  }

  const blob = bytesToBlob(decodeBase64Image(pixelCapture.base64), "image/jpeg");
  return {
    blob,
    fileName: "fhotoshop-selected-layer.jpg",
    width: pixelCapture.width,
    height: pixelCapture.height,
    mimeType: "image/jpeg",
    layer,
    layerName: getLayerDisplayName(layer),
    bounds: pixelCapture.bounds,
    selectionBounds: selectionBounds || null,
    usedSelection: Boolean(selectionBounds),
    captureMode: useDocumentContext ? "document-context" : "layer"
  };
}

function readPngDimensions(bytes) {
  const normalized = normalizeBytes(bytes);
  if (normalized.length < 24) {
    return null;
  }
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let index = 0; index < pngSignature.length; index += 1) {
    if (normalized[index] !== pngSignature[index]) {
      return null;
    }
  }
  const view = new DataView(bytesToArrayBuffer(normalized));
  return {
    width: roundPixel(view.getUint32(16, false)),
    height: roundPixel(view.getUint32(20, false))
  };
}

function shouldNormalizeAiResultToSource(actionConfig) {
  const config = actionConfig || AI_ACTION_CONFIGS.upscale;
  return config.id !== "upscale";
}

async function prepareAiResultForPlacement(resultBytes, imagePayload, actionConfig) {
  const sourceWidth = roundPixel((imagePayload && imagePayload.width) || (imagePayload && imagePayload.bounds && imagePayload.bounds.width));
  const sourceHeight = roundPixel((imagePayload && imagePayload.height) || (imagePayload && imagePayload.bounds && imagePayload.bounds.height));
  const currentDimensions = readPngDimensions(resultBytes);
  if (!shouldNormalizeAiResultToSource(actionConfig) || sourceWidth <= 0 || sourceHeight <= 0) {
    return {
      bytes: resultBytes,
      dimensions: currentDimensions
    };
  }
  if (currentDimensions && currentDimensions.width === sourceWidth && currentDimensions.height === sourceHeight) {
    return {
      bytes: resultBytes,
      dimensions: currentDimensions
    };
  }
  try {
    const normalizedBytes = await resizeImageBytesToPng(resultBytes, sourceWidth, sourceHeight);
    return {
      bytes: normalizedBytes,
      dimensions: {
        width: sourceWidth,
        height: sourceHeight
      }
    };
  } catch (error) {
    console.warn("Could not normalize AI result image to source size.", error);
    return {
      bytes: resultBytes,
      dimensions: currentDimensions
    };
  }
}

function supportsOpenAiInputFidelity(model) {
  return String(model || DEFAULT_OPENAI_IMAGE_MODEL).trim() !== "gpt-image-2";
}

function createAiCancelController() {
  if (typeof AbortController === "function") {
    const controller = new AbortController();
    return {
      signal: controller.signal,
      abort: () => controller.abort()
    };
  }
  const signal = { aborted: false };
  return {
    signal,
    abort: () => {
      signal.aborted = true;
    }
  };
}

function getAbortSignalForFetch(cancelSignal) {
  return cancelSignal && typeof cancelSignal.addEventListener === "function" ? cancelSignal : null;
}

function throwIfAiCancelled(cancelSignal) {
  if (cancelSignal && cancelSignal.aborted) {
    const error = new Error("작업이 취소되었습니다.");
    error.name = "AbortError";
    error.code = "AI_CANCELLED";
    throw error;
  }
}

function isAiCancelError(error) {
  return Boolean(error && (error.name === "AbortError" || error.code === "AI_CANCELLED"));
}

async function requestOpenAiUpscale(apiKey, imagePayload, model, prompt, cancelSignal) {
  throwIfAiCancelled(cancelSignal);
  const resolvedModel = model || DEFAULT_OPENAI_IMAGE_MODEL;
  const formData = new FormData();
  formData.append("model", resolvedModel);
  formData.append("image", imagePayload.blob, imagePayload.fileName || "fhotoshop-source.png");
  formData.append("prompt", prompt || IMAGE_UPSCALE_PROMPT);
  formData.append("size", pickOpenAiOutputSize(imagePayload));
  formData.append("quality", "high");
  formData.append("output_format", "png");
  if (supportsOpenAiInputFidelity(resolvedModel)) {
    formData.append("input_fidelity", "high");
  }
  formData.append("n", "1");

  const requestOptions = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData
  };
  const fetchSignal = getAbortSignalForFetch(cancelSignal);
  if (fetchSignal) {
    requestOptions.signal = fetchSignal;
  }

  const response = await fetch("https://api.openai.com/v1/images/edits", requestOptions);
  throwIfAiCancelled(cancelSignal);

  if (!response.ok) {
    throw new Error(await buildImageRequestError(response, "OpenAI 이미지 업스케일 요청 실패"));
  }

  const data = await response.json();
  const entries = data && Array.isArray(data.data) ? data.data : [];
  if (!entries.length) {
    throw new Error("OpenAI 이미지 응답이 비어 있습니다.");
  }

  const firstEntry = entries[0];
  if (!firstEntry || typeof firstEntry.b64_json !== "string" || !firstEntry.b64_json.trim()) {
    throw new Error("OpenAI 이미지 응답에서 b64_json 결과를 찾지 못했습니다.");
  }

  return decodeBase64Image(firstEntry.b64_json);
}

async function requestGeminiUpscale(apiKey, imagePayload, model, prompt, cancelSignal) {
  throwIfAiCancelled(cancelSignal);
  const inputBytes = await blobToBytes(imagePayload.blob);
  throwIfAiCancelled(cancelSignal);
  const requestOptions = {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt || IMAGE_UPSCALE_PROMPT },
            {
              inline_data: {
                mime_type: imagePayload.mimeType || imagePayload.blob.type || "image/png",
                data: encodeBytesToBase64(inputBytes)
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: pickGeminiAspectRatio(imagePayload),
          imageSize: pickGeminiImageSize(imagePayload)
        }
      }
    })
  };
  const fetchSignal = getAbortSignalForFetch(cancelSignal);
  if (fetchSignal) {
    requestOptions.signal = fetchSignal;
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || DEFAULT_GEMINI_IMAGE_MODEL)}:generateContent`, requestOptions);
  throwIfAiCancelled(cancelSignal);

  if (!response.ok) {
    throw new Error(await buildImageRequestError(response, "Gemini 이미지 업스케일 요청 실패"));
  }

  const data = await response.json();
  const candidates = data && Array.isArray(data.candidates) ? data.candidates : [];
  for (const candidate of candidates) {
    const parts = candidate && candidate.content && Array.isArray(candidate.content.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      const inlineData = part && typeof part === "object" ? part.inlineData || part.inline_data : null;
      const base64Value = inlineData && typeof inlineData.data === "string" ? inlineData.data.trim() : "";
      const mimeType =
        inlineData && typeof inlineData.mimeType === "string"
          ? inlineData.mimeType
          : inlineData && typeof inlineData.mime_type === "string"
            ? inlineData.mime_type
            : "";
      if (base64Value && /^image\//i.test(mimeType || "image/png")) {
        return decodeBase64Image(base64Value);
      }
    }
  }

  throw new Error("Gemini 이미지 응답에서 이미지 결과를 찾지 못했습니다.");
}

async function writeTemporaryPngFile(bytes, fileName) {
  const temporaryFolder = await fs.getTemporaryFolder();
  const file = await temporaryFolder.createFile(fileName, { overwrite: true });
  await file.write(bytesToArrayBuffer(bytes), { format: binaryWriteFormat });
  return file;
}

async function placeUpscaledImageFile(file, sourceDoc, placement, actionConfig) {
  const config = actionConfig || AI_ACTION_CONFIGS.upscale;
  await core.executeAsModal(async () => {
    if (sourceDoc) {
      app.activeDocument = sourceDoc;
    }
    const commands = [
      createPlaceEmbeddedFileCommand(file, placement),
      createRenameActiveLayerCommand(config.layerName)
    ];
    if (config.blendMode) {
      commands.push(createSetActiveLayerBlendModeCommand(config.blendMode));
    }
    const result = await action.batchPlay(commands, { synchronousExecution: false });
    assertBatchPlayResult(result, "업스케일링 결과 배치 실패");
    if (!placement || placement.fitAfterPlace !== false) {
      await fitLayerToBounds(getFirstActiveLayer(sourceDoc || app.activeDocument), placement && placement.bounds);
    }
    if (config.clipToSourceLayer !== false) {
      await createActiveLayerClippingMask();
    }
  }, {
    commandName: config.placeCommandName || "Place AI Result Image",
    interactive: false
  });
}

async function runAiImageUpscale(providerInfo, onProgress, actionConfig, cancelSignal) {
  const config = actionConfig || AI_ACTION_CONFIGS.upscale;
  throwIfAiCancelled(cancelSignal);
  const sourceDoc = app.activeDocument;
  if (!sourceDoc) {
    throw new Error(`${config.label}할 포토샵 문서를 먼저 열어주세요.`);
  }

  const selectedLayer = getSelectedLayerForUpscale(sourceDoc);
  onProgress(`선택 레이어 "${getLayerDisplayName(selectedLayer)}" 인식 중입니다.`, 15);
  throwIfAiCancelled(cancelSignal);
  const imagePayload = await captureSelectedLayerPng(sourceDoc, selectedLayer, config);
  throwIfAiCancelled(cancelSignal);
  onProgress(
    imagePayload.captureMode === "document-context"
      ? (imagePayload.usedSelection ? "선택 영역의 현재 합성본을 API 입력으로 준비했습니다." : "선택 레이어 주변 합성본을 API 입력으로 준비했습니다.")
      : (imagePayload.usedSelection ? "선택 영역 안의 선택 레이어 픽셀만 API 입력으로 준비했습니다." : "API 입력 이미지를 준비했습니다."),
    35
  );
  onProgress(`${providerInfo.label} ${providerInfo.model}로 "${imagePayload.layerName}" ${config.label} 중입니다.`, 55);
  throwIfAiCancelled(cancelSignal);
  const resultBytes =
    providerInfo.provider === "gemini"
      ? await requestGeminiUpscale(providerInfo.apiKey, imagePayload, providerInfo.model, config.prompt, cancelSignal)
      : await requestOpenAiUpscale(providerInfo.apiKey, imagePayload, providerInfo.model, config.prompt, cancelSignal);
  throwIfAiCancelled(cancelSignal);
  onProgress("AI 응답 이미지를 받았습니다.", 85);
  onProgress(`${config.label} 결과를 포토샵 문서에 배치 중입니다.`, 92);
  onProgress(`${config.label} 결과를 원본 위치와 실루엣에 맞춰 배치 중입니다.`, 93);
  throwIfAiCancelled(cancelSignal);
  const placementResult = await prepareAiResultForPlacement(resultBytes, imagePayload, config);
  const resultDimensions = placementResult.dimensions;
  const resultFile = await writeTemporaryPngFile(placementResult.bytes, `${config.filePrefix || "fhotoshop-ai-result"}-${Date.now()}.png`);
  throwIfAiCancelled(cancelSignal);
  await placeUpscaledImageFile(resultFile, sourceDoc, {
    bounds: imagePayload.bounds,
    fitAfterPlace: false,
    image: resultDimensions || {
      width: imagePayload.width,
      height: imagePayload.height
    },
    canvas: {
      width: roundPixel(sourceDoc.width),
      height: roundPixel(sourceDoc.height)
    }
  }, config);

  return {
    provider: providerInfo.label,
    model: providerInfo.model,
    actionLabel: config.label,
    layerName: imagePayload.layerName,
    canvas: resultDimensions
  };
}

function getStitchMode(value) {
  return value === "horizontal" ? "horizontal" : "vertical";
}

function calculateStitchCanvas(metrics, gap, stitchMode) {
  const mode = getStitchMode(stitchMode);
  if (mode === "horizontal") {
    return {
      width: Math.max(1, metrics.reduce((sum, metric) => sum + metric.width, 0) + Math.max(0, metrics.length - 1) * gap),
      height: Math.max(...metrics.map(metric => metric.height))
    };
  }
  return {
    width: Math.max(...metrics.map(metric => metric.width)),
    height: Math.max(1, metrics.reduce((sum, metric) => sum + metric.height, 0) + Math.max(0, metrics.length - 1) * gap)
  };
}

function applyStitchOffsets(metrics, canvas, gap, stitchMode) {
  const mode = getStitchMode(stitchMode);
  let offset = 0;
  for (const metric of metrics) {
    if (mode === "horizontal") {
      metric.offsetX = offset;
      metric.offsetY = Math.round((canvas.height - metric.height) / 2);
      offset += metric.width + gap;
    } else {
      metric.offsetX = Math.round((canvas.width - metric.width) / 2);
      metric.offsetY = offset;
      offset += metric.height + gap;
    }
  }
}

async function stitchPsdFilesAsSmartObjects(items, options, onProgress) {
  if (items.length === 0) {
    throw new Error("합칠 파일을 먼저 선택하세요.");
  }

  const gap = Math.round(Number(options.gap) || 0);
  const stitchMode = getStitchMode(options.stitchMode);
  onProgress(`${items.length}개 파일 크기 분석 중`);
  const metrics = await Promise.all(items.map(item => readFileMetric(item)));

  const canvas = calculateStitchCanvas(metrics, gap, stitchMode);
  applyStitchOffsets(metrics, canvas, gap, stitchMode);

  let finalDoc = null;
  await core.executeAsModal(async executionContext => {
    finalDoc = await app.createDocument({
      width: canvas.width,
      height: canvas.height,
      resolution: metrics[0] ? metrics[0].resolution : 72,
      name: options.outputName || "Image Stitch",
      fill: "transparent"
    });
    app.activeDocument = finalDoc;

    const commands = [];
    for (let index = 0; index < metrics.length; index += 1) {
      const metric = metrics[index];
      commands.push(createPlaceEmbeddedSmartObjectCommand(metric, canvas));
      commands.push(createRenameActiveLayerCommand(smartObjectLayerName(metric.item)));
      if (options.convertSmartObjects) {
        commands.push(createConvertSmartObjectToLayersCommand());
      }
    }

    const label = `${metrics.length}개 스마트 오브젝트 일괄 배치 중`;
    onProgress(label);
    executionContext.reportProgress({
      value: 0.5,
      commandName: label
    });
    const result = await action.batchPlay(commands, { synchronousExecution: false });
    assertBatchPlayResult(result, "스마트 오브젝트 일괄 배치 실패");

    if (finalDoc) {
      app.activeDocument = finalDoc;
    }
  }, {
    commandName: "Stitch files as Smart Objects",
    interactive: false
  });

  return {
    canvas,
    metrics: metrics.map(metric => ({
      id: metric.id,
      width: metric.width,
      height: metric.height,
      resolution: metric.resolution
    }))
  };
}

async function stitchPsdFilesAsLayers(items, options, onProgress) {
  if (items.length === 0) {
    throw new Error("합칠 파일을 먼저 선택하세요.");
  }

  let finalDoc = null;
  const metrics = [];
  const openedSources = [];

  await core.executeAsModal(async executionContext => {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const label = `${index + 1}/${items.length} 열기: ${item.name}`;
      onProgress(label);
      executionContext.reportProgress({
        value: (index + 1) / (items.length * 2),
        commandName: label
      });

      const sourceDoc = await app.open(item.entry);
      const width = roundPixel(sourceDoc.width);
      const height = roundPixel(sourceDoc.height);
      const resolution = Number(sourceDoc.resolution) || 72;
      metrics.push({ id: item.id, width, height, resolution });
      openedSources.push({ doc: sourceDoc, item, width, height, resolution });
    }

    const maxWidth = Math.max(...openedSources.map(source => source.width));
    const totalHeight = openedSources.reduce((sum, source) => sum + source.height, 0) + Math.max(0, openedSources.length - 1) * options.gap;
    finalDoc = await app.createDocument({
      width: maxWidth,
      height: Math.max(1, totalHeight),
      resolution: openedSources[0] ? openedSources[0].resolution : 72,
      name: options.outputName || "Image Stitch",
      fill: "transparent"
    });

    let offsetY = 0;
    for (let index = 0; index < openedSources.length; index += 1) {
      const source = openedSources[index];
      const label = `${index + 1}/${openedSources.length} 복사: ${source.item.name}`;
      onProgress(label);
      executionContext.reportProgress({
        value: (items.length + index + 1) / (items.length * 2),
        commandName: label
      });

      const layers = getTopLevelLayers(source.doc);
      const copiedLayers = layers.length > 0 ? (await source.doc.duplicateLayers(layers, finalDoc) || []) : [];
      app.activeDocument = finalDoc;
      if (copiedLayers.length === 0) {
        throw new Error(`${source.item.name} 레이어를 복사하지 못했습니다.`);
      }
      renameLayers(copiedLayers, segmentGroupName(source.item, index));
      await translateLayers(copiedLayers, offsetY);
      offsetY += source.height + options.gap;
    }

    if (options.closeSources) {
      for (const source of openedSources) {
        if (source.doc && source.doc !== finalDoc) {
          await closeWithoutSaving(source.doc);
        }
      }
    }

    if (finalDoc) {
      app.activeDocument = finalDoc;
    }
  }, {
    commandName: "Stitch PSD files",
    interactive: false
  });

  return metrics;
}

function ControlButton({ children, className = "", disabled = false, onClick, title, ariaLabel, ariaControls, ariaExpanded }) {
  function handleClick(event) {
    if (disabled) {
      return;
    }
    if (onClick) {
      onClick(event);
    }
  }

  function handleKeyDown(event) {
    if (disabled || !onClick) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick(event);
    }
  }

  return (
    <div
      className={`control-button ${className}${disabled ? " disabled" : ""}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled ? "true" : "false"}
      aria-label={ariaLabel}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      title={title}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

function ChevronIcon({ direction }) {
  const points = direction === "up" ? "4 10 8 6 12 10" : "4 6 8 10 12 6";
  return (
    <svg className="chevron-icon" viewBox="0 0 16 16" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function App() {
  const [items, setItems] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [gap, setGap] = useState(0);
  const [closeSources, setCloseSources] = useState(true);
  const [convertSmartObjects, setConvertSmartObjects] = useState(true);
  const [stitchMode, setStitchMode] = useState("vertical");
  const [activeTab, setActiveTab] = useState("files");
  const [openAiCategory, setOpenAiCategory] = useState("category-1");
  const [openSettingsCategory, setOpenSettingsCategory] = useState("psd");
  const [geminiApiKey, setGeminiApiKey] = useState(() => readStoredApiKey(API_KEY_STORAGE_KEYS.gemini));
  const [gptApiKey, setGptApiKey] = useState(() => readStoredApiKey(API_KEY_STORAGE_KEYS.gpt));
  const [apiKeyStatus, setApiKeyStatus] = useState("");
  const [aiActionStatus, setAiActionStatus] = useState("업스케일링 대기");
  const [aiProgress, setAiProgress] = useState(0);
  const [selectedAiActionId, setSelectedAiActionId] = useState("upscale");
  const [selectedAiModelId, setSelectedAiModelId] = useState(() => readStoredApiKey(API_KEY_STORAGE_KEYS.aiModel) || AI_MODEL_OPTIONS[0].id);
  const [aiModelDialogOpen, setAiModelDialogOpen] = useState(false);
  const [aiCancelRequested, setAiCancelRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("PSD/PSB, PNG, GIF, JPG 등 이미지 파일이나 ZIP을 선택하세요.");
  const [lastResultSize, setLastResultSize] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [sortMenu, setSortMenu] = useState(null);
  const [sortMode, setSortMode] = useState("name-asc");
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const aiCancelControllerRef = useRef(null);
  const marqueeRef = useRef(null);
  const marqueeActive = Boolean(marquee);

  useEffect(() => {
    marqueeRef.current = marquee;
  }, [marquee]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeContextMenu();
        closeSortMenu();
        setSelectedIds([]);
        setSelectionAnchorId(null);
        setMarquee(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!marqueeActive) {
      return undefined;
    }

    function handleMouseMove(event) {
      const current = marqueeRef.current;
      if (!current) {
        return;
      }
      event.preventDefault();
      const next = {
        ...current,
        currentX: event.clientX,
        currentY: event.clientY
      };
      marqueeRef.current = next;
      setMarquee(next);
      const nextSelectedIds = getItemIdsInMarquee(next);
      setSelectedIds(nextSelectedIds);
      setSelectionAnchorId(nextSelectedIds.length > 0 ? nextSelectedIds[0] : null);
    }

    function handleMouseUp() {
      marqueeRef.current = null;
      setMarquee(null);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [marqueeActive]);

  useEffect(() => {
    if (!draggingId) {
      return undefined;
    }

    function handleMouseUp() {
      finishDrag();
    }

    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingId]);

  async function chooseFiles() {
    if (busy) {
      return;
    }
    let files = null;
    try {
      files = await fs.getFileForOpening({
        allowMultiple: true
      });
    } catch (error) {
      setStatus(error && error.message ? error.message : String(error));
      return;
    }
    if (!files || files.length === 0) {
      return;
    }
    setBusy(true);
    setStatus("선택한 파일을 준비하는 중입니다.");
    setLastResultSize(null);
    try {
      const selectedFiles = Array.isArray(files) ? files : [files];
      const fileItems = await createFileItemsFromEntries(selectedFiles, message => setStatus(message));
      if (fileItems.length === 0) {
        setStatus("선택한 파일 또는 ZIP 안에서 지원하는 이미지 파일을 찾지 못했습니다.");
        return;
      }

      const existingKeys = new Set(items.map(item => item.fileKey || getEntryKey(item.entry) || item.name));
      const uniqueItems = fileItems.filter(item => {
        const key = item.fileKey || item.name;
        if (existingKeys.has(key)) {
          return false;
        }
        existingKeys.add(key);
        return true;
      });
      const nextItems = items.length === 0 ? sortItems(uniqueItems, sortMode) : items.concat(uniqueItems);
      setItems(nextItems);
      setSelectedIds(uniqueItems.map(item => item.id));
      setSelectionAnchorId(uniqueItems.length > 0 ? uniqueItems[0].id : null);
      setMarquee(null);
      closeContextMenu();
      closeSortMenu();
      setStatus(`${uniqueItems.length}개 파일을 추가했습니다. 전체 ${nextItems.length}개입니다.`);
    } catch (error) {
      console.error(error);
      setStatus(error && error.message ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function runStitch() {
    if (busy || items.length === 0) {
      return;
    }
    setBusy(true);
    setStatus("파일을 스마트 오브젝트로 배치하는 중입니다.");
    setLastResultSize(null);
    try {
      const result = await stitchPsdFilesAsSmartObjects(
        items,
        {
          gap: Number(gap) || 0,
          outputName: "Image Stitch",
          convertSmartObjects,
          stitchMode
        },
        message => setStatus(message)
      );
      setLastResultSize(result.canvas);
      setStatus(`완료: ${items.length}개 파일을 ${stitchMode === "horizontal" ? "가로" : "세로"}로 합쳤습니다.`);
    } catch (error) {
      console.error(error);
      setStatus(error && error.message ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function runLayerStitch() {
    if (busy || items.length === 0) {
      return;
    }
    setBusy(true);
    setStatus("Photoshop에서 파일을 열어 레이어를 복사하는 중입니다.");
    setLastResultSize(null);
    try {
      const metrics = await stitchPsdFilesAsLayers(
        items,
        {
          gap: Number(gap) || 0,
          closeSources,
          outputName: "Image Stitch"
        },
        message => setStatus(message)
      );
      setStatus(`완료: ${items.length}개 파일 레이어를 세로로 합쳤습니다.`);
    } catch (error) {
      console.error(error);
      setStatus(error && error.message ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function adjustGap(delta) {
    setGap(current => Math.round(Number(current) || 0) + delta);
  }

  function moveUp(index) {
    setItems(current => moveItem(current, index, index - 1));
  }

  function moveDown(index) {
    setItems(current => moveItem(current, index, index + 1));
  }

  function removeItemsByIds(itemIds) {
    const idSet = new Set(itemIds.filter(Boolean));
    if (idSet.size === 0) {
      return;
    }
    setItems(current => current.filter(item => !idSet.has(item.id)));
    setSelectedIds(current => current.filter(itemId => !idSet.has(itemId)));
    setSelectionAnchorId(current => (current && idSet.has(current) ? null : current));
    setDraggingId(current => (current && idSet.has(current) ? null : current));
    setMarquee(null);
    setLastResultSize(null);
  }

  function clearItems() {
    setItems([]);
    setSelectedIds([]);
    setSelectionAnchorId(null);
    setDraggingId(null);
    setMarquee(null);
    setLastResultSize(null);
    setStatus("목록을 비웠습니다.");
    closeContextMenu();
  }

  function getRangeItemIds(anchorId, targetId) {
    const anchorIndex = items.findIndex(item => item.id === anchorId);
    const targetIndex = items.findIndex(item => item.id === targetId);
    if (anchorIndex < 0 || targetIndex < 0) {
      return [targetId];
    }
    const startIndex = Math.min(anchorIndex, targetIndex);
    const endIndex = Math.max(anchorIndex, targetIndex);
    return items.slice(startIndex, endIndex + 1).map(item => item.id);
  }

  function mergeSelectedIds(baseIds, addedIds) {
    const selectedSet = new Set(baseIds.concat(addedIds));
    return items.filter(item => selectedSet.has(item.id)).map(item => item.id);
  }

  function toggleSelectedId(itemId) {
    if (selectedIds.indexOf(itemId) !== -1) {
      return selectedIds.filter(selectedId => selectedId !== itemId);
    }
    return mergeSelectedIds(selectedIds, [itemId]);
  }

  function handleModifiedRowSelection(event, item) {
    event.preventDefault();
    closeContextMenu();
    closeSortMenu();
    setDraggingId(null);
    setMarquee(null);

    if (event.shiftKey) {
      const anchorId = selectionAnchorId && items.some(currentItem => currentItem.id === selectionAnchorId)
        ? selectionAnchorId
        : (selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : item.id);
      const rangeIds = getRangeItemIds(anchorId, item.id);
      const nextIds = event.ctrlKey || event.metaKey ? mergeSelectedIds(selectedIds, rangeIds) : rangeIds;
      setSelectedIds(nextIds);
      setSelectionAnchorId(anchorId);
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      setSelectedIds(toggleSelectedId(item.id));
      setSelectionAnchorId(item.id);
    }
  }

  function getContextTargetIds(itemId) {
    if (contextMenu && Array.isArray(contextMenu.itemIds) && contextMenu.itemIds.indexOf(itemId) !== -1) {
      return contextMenu.itemIds;
    }
    if (selectedIds.indexOf(itemId) !== -1 && selectedIds.length > 1) {
      return selectedIds;
    }
    return [itemId];
  }

  function moveItemsToStart(itemIds) {
    const idSet = new Set(itemIds);
    setItems(current => {
      const selected = current.filter(item => idSet.has(item.id));
      const rest = current.filter(item => !idSet.has(item.id));
      return selected.concat(rest);
    });
    setSelectedIds(itemIds);
  }

  function moveItemsToEnd(itemIds) {
    const idSet = new Set(itemIds);
    setItems(current => {
      const selected = current.filter(item => idSet.has(item.id));
      const rest = current.filter(item => !idSet.has(item.id));
      return rest.concat(selected);
    });
    setSelectedIds(itemIds);
  }

  function removeItem(itemId) {
    removeItemsByIds(getContextTargetIds(itemId));
    closeContextMenu();
  }

  function moveItemToStart(itemId) {
    moveItemsToStart(getContextTargetIds(itemId));
    closeContextMenu();
  }

  function moveItemToEnd(itemId) {
    moveItemsToEnd(getContextTargetIds(itemId));
    closeContextMenu();
  }

  function handleContextMenuKey(event, action) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function closeSortMenu() {
    setSortMenu(null);
  }

  function closeMenus() {
    closeContextMenu();
    closeSortMenu();
  }

  function openSortMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    if (busy || items.length < 2) {
      return;
    }
    closeContextMenu();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 126;
    const menuHeight = 68;
    const viewportWidth = typeof window !== "undefined" && window.innerWidth ? window.innerWidth : rect.right + menuWidth;
    const viewportHeight = typeof window !== "undefined" && window.innerHeight ? window.innerHeight : rect.bottom + menuHeight;
    setSortMenu({
      x: Math.max(4, Math.min(rect.right - menuWidth, viewportWidth - menuWidth - 4)),
      y: Math.max(4, Math.min(rect.bottom + 3, viewportHeight - menuHeight - 4))
    });
  }

  function applySortMode(mode) {
    setSortMode(mode);
    setItems(current => sortItems(current, mode));
    closeSortMenu();
  }

  function getMarqueeRect(selection) {
    const left = Math.min(selection.startX, selection.currentX);
    const top = Math.min(selection.startY, selection.currentY);
    const right = Math.max(selection.startX, selection.currentX);
    const bottom = Math.max(selection.startY, selection.currentY);
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top
    };
  }

  function getMarqueeStyle(selection) {
    const rect = getMarqueeRect(selection);
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };
  }

  function rectsIntersect(rect, rowRect) {
    return rect.left <= rowRect.right && rect.right >= rowRect.left && rect.top <= rowRect.bottom && rect.bottom >= rowRect.top;
  }

  function getItemIdsInMarquee(selection) {
    const rect = getMarqueeRect(selection);
    return Array.from(document.querySelectorAll(".file-row[data-item-id]"))
      .filter(row => rectsIntersect(rect, row.getBoundingClientRect()))
      .map(row => row.getAttribute("data-item-id"))
      .filter(Boolean);
  }

  function startMarqueeSelection(event) {
    if (busy || event.button !== 0 || items.length === 0 || event.target.closest(".file-row")) {
      return;
    }
    event.preventDefault();
    closeContextMenu();
    closeSortMenu();
    setDraggingId(null);
    setSelectedIds([]);
    setSelectionAnchorId(null);
    const next = {
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY
    };
    marqueeRef.current = next;
    setMarquee(next);
  }

  function openContextMenu(event, item) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) {
      return;
    }
    closeSortMenu();
    const targetIds = selectedIds.indexOf(item.id) !== -1 && selectedIds.length > 0 ? selectedIds.slice() : [item.id];
    const menuWidth = 126;
    const menuHeight = 68;
    const viewportWidth = typeof window !== "undefined" && window.innerWidth ? window.innerWidth : event.clientX + menuWidth;
    const viewportHeight = typeof window !== "undefined" && window.innerHeight ? window.innerHeight : event.clientY + menuHeight;
    setSelectedIds(targetIds);
    setSelectionAnchorId(item.id);
    setContextMenu({
      itemId: item.id,
      itemIds: targetIds,
      x: Math.max(4, Math.min(event.clientX, viewportWidth - menuWidth - 4)),
      y: Math.max(4, Math.min(event.clientY, viewportHeight - menuHeight - 4))
    });
  }

  function openListContextMenu(event) {
    if (busy || items.length === 0 || event.target.closest(".file-row")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    closeSortMenu();
    const menuWidth = 126;
    const menuHeight = 24;
    const viewportWidth = typeof window !== "undefined" && window.innerWidth ? window.innerWidth : event.clientX + menuWidth;
    const viewportHeight = typeof window !== "undefined" && window.innerHeight ? window.innerHeight : event.clientY + menuHeight;
    setContextMenu({
      type: "list",
      x: Math.max(4, Math.min(event.clientX, viewportWidth - menuWidth - 4)),
      y: Math.max(4, Math.min(event.clientY, viewportHeight - menuHeight - 4))
    });
  }

  function handleRowMouseDown(event, item) {
    if (busy || event.button !== 0 || isRowControlTarget(event.target)) {
      return;
    }
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      handleModifiedRowSelection(event, item);
      return;
    }
    event.preventDefault();
    closeContextMenu();
    closeSortMenu();
    setSelectedIds([item.id]);
    setSelectionAnchorId(item.id);
    setDraggingId(item.id);
  }

  function handleRowMouseEnter(targetId) {
    if (!draggingId || draggingId === targetId) {
      return;
    }
    setItems(current => {
      const fromIndex = current.findIndex(item => item.id === draggingId);
      const toIndex = current.findIndex(item => item.id === targetId);
      return moveItem(current, fromIndex, toIndex);
    });
  }

  function finishDrag() {
    setDraggingId(null);
  }

  function toggleAiCategory(categoryId) {
    setOpenAiCategory(current => (current === categoryId ? null : categoryId));
  }

  function toggleSettingsCategory(categoryId) {
    setOpenSettingsCategory(current => (current === categoryId ? null : categoryId));
  }

  function applyApiKeys() {
    const savedGemini = writeStoredApiKey(API_KEY_STORAGE_KEYS.gemini, sanitizeApiKey(geminiApiKey));
    const savedGpt = writeStoredApiKey(API_KEY_STORAGE_KEYS.gpt, sanitizeApiKey(gptApiKey));
    const message = savedGemini && savedGpt ? "API Key가 적용되었습니다." : "API Key는 현재 세션에만 적용되었습니다.";
    setApiKeyStatus(message);
    setAiActionStatus(message);
    setStatus(message);
  }

  function updateAiActionStatus(message, progress) {
    if (Number.isFinite(Number(progress))) {
      setAiProgress(Math.max(0, Math.min(100, Math.round(Number(progress)))));
    }
    setAiActionStatus(message);
    setStatus(message);
  }

  function markAiButtonPressed(actionItem) {
    const config = getAiActionConfig(actionItem && actionItem.id);
    if (busy || !config) {
      return;
    }
    updateAiActionStatus(`${config.label} 버튼을 눌렀습니다.`, 5);
  }

  function openAiModelDialog(actionItem) {
    const actionConfig = getAiActionConfig(actionItem && actionItem.id) || AI_ACTION_CONFIGS.upscale;
    const storedOption = getAiModelOption(selectedAiModelId);
    const fallbackOption = sanitizeApiKey(gptApiKey)
      ? AI_MODEL_OPTIONS.find(option => option.provider === "openai") || storedOption
      : sanitizeApiKey(geminiApiKey)
        ? AI_MODEL_OPTIONS.find(option => option.provider === "gemini") || storedOption
        : storedOption;
    setSelectedAiActionId(actionConfig.id);
    setSelectedAiModelId(fallbackOption.id);
    setAiModelDialogOpen(true);
    updateAiActionStatus(`${actionConfig.label}에 사용할 AI 모델을 선택해주세요.`, 5);
  }

  function closeAiModelDialog() {
    setAiModelDialogOpen(false);
  }

  function cancelAiAction() {
    const cancelController = aiCancelControllerRef.current;
    if (!busy || !cancelController) {
      return;
    }
    setAiCancelRequested(true);
    updateAiActionStatus("취소 요청 중입니다.", aiProgress);
    cancelController.abort();
  }

  async function startAiUpscaleWithModel(modelId) {
    const actionConfig = getAiActionConfig(selectedAiActionId) || AI_ACTION_CONFIGS.upscale;
    const providerInfo = resolveUpscaleProvider(gptApiKey, geminiApiKey, modelId);
    const option = getAiModelOption(modelId);
    if (!providerInfo) {
      const keyLabel = option.provider === "gemini" ? "Gemini API Key" : "GPT API Key";
      const message = `${option.label} ${option.detail}을 사용하려면 설정에서 ${keyLabel}를 먼저 입력해주세요.`;
      setApiKeyStatus(message);
      updateAiActionStatus(message, 0);
      setOpenSettingsCategory("ai");
      return;
    }

    writeStoredApiKey(API_KEY_STORAGE_KEYS.aiModel, modelId);
    setAiModelDialogOpen(false);
    const cancelController = createAiCancelController();
    aiCancelControllerRef.current = cancelController;
    setAiCancelRequested(false);
    setBusy(true);
    setApiKeyStatus("");
    setLastResultSize(null);
    updateAiActionStatus(`${providerInfo.label} ${providerInfo.model} ${actionConfig.label}을 시작합니다.`, 8);
    try {
      const result = await runAiImageUpscale(providerInfo, (message, progress) => updateAiActionStatus(message, progress), actionConfig, cancelController.signal);
      setLastResultSize(result.canvas);
      updateAiActionStatus(`완료: ${result.provider} ${result.model} ${result.actionLabel} 결과를 "${result.layerName}" 위에 새 레이어로 추가했습니다.`, 100);
    } catch (error) {
      if (isAiCancelError(error) || (cancelController.signal && cancelController.signal.aborted)) {
        updateAiActionStatus("취소되었습니다.", 0);
      } else {
        console.error(error);
        updateAiActionStatus(error && error.message ? error.message : String(error), 0);
      }
    } finally {
      if (aiCancelControllerRef.current === cancelController) {
        aiCancelControllerRef.current = null;
      }
      setAiCancelRequested(false);
      setBusy(false);
    }
  }

  async function handleAiAction(actionItem) {
    if (busy) {
      return;
    }

    const actionConfig = getAiActionConfig(actionItem && actionItem.id);
    if (!actionConfig) {
      const label = actionItem && actionItem.label ? actionItem.label : "AI 기능";
      updateAiActionStatus(`${label}은 아직 연결할 로직을 준비 중입니다.`, 0);
      return;
    }

    updateAiActionStatus(`${actionConfig.label} 버튼을 눌렀습니다.`, 5);
    openAiModelDialog(actionItem);
  }

  function isRowControlTarget(target) {
    return Boolean(target && target.closest && target.closest(".row-actions"));
  }

  const currentSortOption = getSortOption(sortMode);
  const selectedAiModelOption = getAiModelOption(selectedAiModelId);
  const selectedAiModelHasKey = Boolean(getApiKeyForModelOption(selectedAiModelOption, gptApiKey, geminiApiKey));

  return (
    <div className="app-shell" onClick={closeMenus}>
      <nav className="tabs" aria-label="File stitcher sections">
        <ControlButton
          className={`tab-button ${activeTab === "files" ? "active" : ""}`}
          onClick={() => setActiveTab("files")}
        >
          파일 합치기
        </ControlButton>
        <ControlButton
          className={`tab-button ${activeTab === "ai" ? "active" : ""}`}
          onClick={() => setActiveTab("ai")}
        >
          AI 보정하기
        </ControlButton>
        <ControlButton
          className={`tab-button ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          설정
        </ControlButton>
      </nav>

      {activeTab === "files" && (
        <div className="tab-panel">
          <section className="toolbar">
            <ControlButton className="primary" onClick={chooseFiles} disabled={busy}>
              이미지/ZIP 파일 열기
            </ControlButton>
          </section>

          <div className="list-header">
            <div className="section-title">선택된 파일 리스트 <span>{items.length}</span></div>
            <ControlButton className="sort-select" onClick={openSortMenu} disabled={busy || items.length < 2} ariaLabel="정렬 메뉴">
              <span className="sort-select-label">{items.length < 2 ? "-" : currentSortOption.shortLabel}</span>
              <span className="sort-select-arrow">
                <ChevronIcon direction="down" />
              </span>
            </ControlButton>
          </div>
          <section className="file-list" aria-label="File order" onMouseDown={startMarqueeSelection} onContextMenu={openListContextMenu} onScroll={closeMenus}>
            {items.length === 0 ? (
              <div className="empty">PSD/PNG/GIF/JPG 등 이미지 파일이나 ZIP을 선택하면 여기에 순서가 표시됩니다.</div>
            ) : (
              <div className="file-table">
                <div className="file-row file-row-head">
                  <div className="index">순서</div>
                  <div className="file-main">파일명</div>
                  <div className="row-actions">이동</div>
                </div>
                {items.map((item, index) => {
                  const selected = selectedIds.indexOf(item.id) !== -1;
                  return (
                    <div
                      className={`file-row ${item.id === draggingId ? "dragging" : ""} ${selected ? "selected" : ""}`}
                      key={item.id}
                      data-item-id={item.id}
                      onMouseDown={event => handleRowMouseDown(event, item)}
                      onMouseEnter={() => handleRowMouseEnter(item.id)}
                      onContextMenu={event => openContextMenu(event, item)}
                    >
                      <div className="index">{String(index + 1).padStart(2, "0")}</div>
                      <div className="file-main">
                        <strong>{item.name}</strong>
                        {item.sourceZipName && <span className="file-source">{item.sourceZipName}</span>}
                      </div>
                      <div className="row-actions">
                        <ControlButton className="icon-button arrow-up" ariaLabel="위로 이동" title="위로 이동" onClick={() => moveUp(index)} disabled={busy || index === 0}>
                          <ChevronIcon direction="up" />
                        </ControlButton>
                        <ControlButton className="icon-button arrow-down" ariaLabel="아래로 이동" title="아래로 이동" onClick={() => moveDown(index)} disabled={busy || index === items.length - 1}>
                          <ChevronIcon direction="down" />
                        </ControlButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          {marquee && <div className="marquee-box" style={getMarqueeStyle(marquee)} />}
          {sortMenu && (
            <div
              className="sort-menu"
              role="menu"
              style={{ left: sortMenu.x, top: sortMenu.y }}
              onClick={event => event.stopPropagation()}
              onContextMenu={event => event.preventDefault()}
            >
              {SORT_OPTIONS.map(option => (
                <div
                  className={`sort-menu-item ${sortMode === option.mode ? "active" : ""}`}
                  role="menuitem"
                  tabIndex={0}
                  key={option.mode}
                  onClick={() => applySortMode(option.mode)}
                  onKeyDown={event => handleContextMenuKey(event, () => applySortMode(option.mode))}
                >
                  {option.label}
                </div>
              ))}
            </div>
          )}
          {contextMenu && (
            <div
              className="context-menu"
              role="menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={event => event.stopPropagation()}
              onContextMenu={event => event.preventDefault()}
            >
              {contextMenu.type === "list" ? (
                <div className="context-menu-item" role="menuitem" tabIndex={0} onClick={clearItems} onKeyDown={event => handleContextMenuKey(event, clearItems)}>
                  전체 삭제
                </div>
              ) : (
                <>
                  <div className="context-menu-item" role="menuitem" tabIndex={0} onClick={() => removeItem(contextMenu.itemId)} onKeyDown={event => handleContextMenuKey(event, () => removeItem(contextMenu.itemId))}>
                    {contextMenu.itemIds && contextMenu.itemIds.length > 1 ? "선택 항목 제거" : "목록에서 제거"}
                  </div>
                  <div className="context-menu-item" role="menuitem" tabIndex={0} onClick={() => moveItemToStart(contextMenu.itemId)} onKeyDown={event => handleContextMenuKey(event, () => moveItemToStart(contextMenu.itemId))}>
                    {contextMenu.itemIds && contextMenu.itemIds.length > 1 ? "선택 항목 맨 위로" : "맨 위로"}
                  </div>
                  <div className="context-menu-item" role="menuitem" tabIndex={0} onClick={() => moveItemToEnd(contextMenu.itemId)} onKeyDown={event => handleContextMenuKey(event, () => moveItemToEnd(contextMenu.itemId))}>
                    {contextMenu.itemIds && contextMenu.itemIds.length > 1 ? "선택 항목 맨 아래로" : "맨 아래로"}
                  </div>
                </>
              )}
            </div>
          )}

          <section className="bottom-panel">
            <section className="status">
              <strong>{busy ? "실행 중" : "상태"}</strong>
              <span>{items.length > 0 ? `${items.length}개 선택됨 · ${status}` : status}</span>
              {lastResultSize && <em>최근 결과 크기: {lastResultSize.width} x {lastResultSize.height}px</em>}
            </section>
            <ControlButton className="primary merge-button" onClick={runStitch} disabled={busy || items.length === 0}>
              파일 합치기
            </ControlButton>
          </section>
        </div>
      )}

      {activeTab === "ai" && (
        <div className="tab-panel ai-panel">
          <div className="ai-panel-content">
          {AI_CATEGORIES.map(category => {
            const isOpen = openAiCategory === category.id;
            return (
              <section className={`ai-category ${isOpen ? "open" : ""}`} key={category.id}>
                <ControlButton
                  className="ai-category-button"
                  onClick={() => toggleAiCategory(category.id)}
                  ariaLabel={category.label}
                  ariaControls={`${category.id}-actions`}
                  ariaExpanded={isOpen ? "true" : "false"}
                >
                  <span>{category.label}</span>
                  <ChevronIcon direction={isOpen ? "up" : "down"} />
                </ControlButton>
                {isOpen && (
                  <div className="ai-action-list" id={`${category.id}-actions`}>
                    {category.actions.map(actionItem => (
                      <div
                        role="button"
                        tabIndex={busy ? -1 : 0}
                        aria-disabled={busy ? "true" : "false"}
                        className={`ai-action-button ${busy ? "disabled" : ""}`}
                        key={`${category.id}-${actionItem.id}`}
                        onMouseDown={() => markAiButtonPressed(actionItem)}
                        onClick={() => handleAiAction(actionItem)}
                        onKeyDown={event => {
                          if (busy) {
                            return;
                          }
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            markAiButtonPressed(actionItem);
                            handleAiAction(actionItem);
                          }
                        }}
                      >
                        <span className="ai-action-label">{actionItem.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          </div>
          {aiModelDialogOpen && (
            <section className="ai-model-picker" role="dialog" aria-label="AI 모델 선택">
              <div className="ai-model-dialog-title">
                <strong>모델 선택</strong>
              </div>
              <div className="ai-model-list">
                {AI_MODEL_OPTIONS.map(option => {
                  const isSelected = selectedAiModelOption.id === option.id;
                  const hasKey = Boolean(getApiKeyForModelOption(option, gptApiKey, geminiApiKey));
                  return (
                    <div
                      role="button"
                      tabIndex={hasKey ? 0 : -1}
                      aria-disabled={hasKey ? "false" : "true"}
                      className={`ai-model-option ${isSelected ? "selected" : ""} ${hasKey ? "" : "disabled"}`}
                      key={option.id}
                      onClick={() => {
                        if (hasKey) {
                          setSelectedAiModelId(option.id);
                        }
                      }}
                      onKeyDown={event => {
                        if (!hasKey) {
                          return;
                        }
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedAiModelId(option.id);
                        }
                      }}
                    >
                      <span>{option.label}</span>
                      <strong>{option.detail}</strong>
                      {!hasKey && <em>{option.provider === "gemini" ? "Gemini API Key 필요" : "GPT API Key 필요"}</em>}
                    </div>
                  );
                })}
              </div>
              {!selectedAiModelHasKey && (
                <p className="ai-model-help">
                  선택한 모델의 API Key를 설정에서 먼저 입력해주세요.
                </p>
              )}
              <div className="ai-model-dialog-actions">
                <ControlButton className="secondary ai-model-cancel" onClick={closeAiModelDialog} disabled={busy}>
                  취소
                </ControlButton>
                <ControlButton className="primary ai-model-start" onClick={() => startAiUpscaleWithModel(selectedAiModelOption.id)} disabled={busy || !selectedAiModelHasKey}>
                  시작
                </ControlButton>
              </div>
            </section>
          )}
          <section className={`ai-status ai-bottom-panel ${busy ? "running" : ""}`} aria-live="polite">
            <div className="ai-progress-row" style={{ alignItems: "flex-start", gap: 0 }}>
              <span style={{ flex: "1 1 auto", minWidth: 0, paddingRight: 72 }}>{aiActionStatus}</span>
              <strong style={{ flex: "0 0 72px", textAlign: "right" }}>{busy ? `${aiProgress}%` : aiProgress === 100 ? "완료" : ""}</strong>
            </div>
            {busy && (
              <div className="ai-progress-track" aria-hidden="true" style={{ marginTop: 20 }}>
                <div className="ai-progress-fill" style={{ width: `${Math.max(0, Math.min(100, aiProgress))}%` }} />
              </div>
            )}
            {busy && (
              <div className="ai-run-actions" style={{ marginTop: 0, paddingTop: 28 }}>
                <ControlButton className="secondary ai-run-cancel" onClick={cancelAiAction} disabled={aiCancelRequested}>
                  {aiCancelRequested ? "취소 중" : "취소"}
                </ControlButton>
              </div>
            )}
            {lastResultSize && <em>최근 결과 크기: {lastResultSize.width} x {lastResultSize.height}px</em>}
          </section>
        </div>
      )}

      {activeTab === "settings" && (
        <section className="settings">
          <section className={`settings-category ${openSettingsCategory === "psd" ? "open" : ""}`}>
            <ControlButton
              className="settings-category-button"
              onClick={() => toggleSettingsCategory("psd")}
              ariaLabel="파일 합치기"
              ariaControls="settings-psd-content"
              ariaExpanded={openSettingsCategory === "psd" ? "true" : "false"}
            >
              <span>파일 합치기</span>
              <ChevronIcon direction={openSettingsCategory === "psd" ? "up" : "down"} />
            </ControlButton>
            {openSettingsCategory === "psd" && (
              <div className="settings-category-content" id="settings-psd-content">
                <div className="setting-row">
                  <div className="setting-label">합치기 방향</div>
                  <div className="segmented-control" role="group" aria-label="합치기 방향">
                    <ControlButton className={`segment-button ${stitchMode === "vertical" ? "active" : ""}`} onClick={() => setStitchMode("vertical")} disabled={busy}>
                      세로
                    </ControlButton>
                    <ControlButton className={`segment-button ${stitchMode === "horizontal" ? "active" : ""}`} onClick={() => setStitchMode("horizontal")} disabled={busy}>
                      가로
                    </ControlButton>
                  </div>
                </div>
                <div className="setting-row">
                  <span className="setting-label">콘텐츠 사이 간격(px)</span>
                  <div className="gap-stepper" aria-label="콘텐츠 사이 간격 픽셀">
                    <ControlButton className="stepper-button" onClick={() => adjustGap(-1)} disabled={busy} ariaLabel="콘텐츠 사이 간격 줄이기">
                      -
                    </ControlButton>
                    <div className="gap-value" aria-live="polite">{gap}</div>
                    <ControlButton className="stepper-button" onClick={() => adjustGap(1)} disabled={busy} ariaLabel="콘텐츠 사이 간격 늘리기">
                      +
                    </ControlButton>
                  </div>
                </div>
                <label className="setting-row check-row">
                  <span className="setting-label">스마트 오브젝트를 레이어로 변환</span>
                  <input type="checkbox" checked={convertSmartObjects} onChange={event => setConvertSmartObjects(event.target.checked)} disabled={busy} />
                </label>
              </div>
            )}
          </section>

          <section className={`settings-category ${openSettingsCategory === "ai" ? "open" : ""}`}>
            <ControlButton
              className="settings-category-button"
              onClick={() => toggleSettingsCategory("ai")}
              ariaLabel="AI 보정하기"
              ariaControls="settings-ai-content"
              ariaExpanded={openSettingsCategory === "ai" ? "true" : "false"}
            >
              <span>AI 보정하기</span>
              <ChevronIcon direction={openSettingsCategory === "ai" ? "up" : "down"} />
            </ControlButton>
            {openSettingsCategory === "ai" && (
              <div className="settings-category-content api-key-settings" id="settings-ai-content" aria-label="AI API Key 설정">
                <label className="api-key-row">
                  <span className="setting-label">Gemini API Key</span>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={event => setGeminiApiKey(event.target.value)}
                    disabled={busy}
                    placeholder="Gemini API Key"
                  />
                </label>
                <label className="api-key-row">
                  <span className="setting-label">GPT API Key</span>
                  <input
                    type="password"
                    value={gptApiKey}
                    onChange={event => setGptApiKey(event.target.value)}
                    disabled={busy}
                    placeholder="GPT API Key"
                  />
                </label>
                <div className="api-key-actions">
                  <ControlButton className="primary apply-api-key-button" onClick={applyApiKeys} disabled={busy}>
                    적용하기
                  </ControlButton>
                  {apiKeyStatus && <span className="api-key-status">{apiKeyStatus}</span>}
                </div>
              </div>
            )}
          </section>
        </section>
      )}

      {activeTab === "settings" && (
        <section className="status">
          <strong>{busy ? "실행 중" : "상태"}</strong>
          <span>{items.length > 0 ? `${items.length}개 선택됨 · ${status}` : status}</span>
          {lastResultSize && <em>최근 결과 크기: {lastResultSize.width} x {lastResultSize.height}px</em>}
        </section>
      )}

      {false && aiModelDialogOpen && (
        <div className="ai-model-dialog-backdrop" onMouseDown={closeAiModelDialog}>
          <section className="ai-model-dialog" role="dialog" aria-label="AI 모델 선택" onMouseDown={event => event.stopPropagation()}>
            <div className="ai-model-dialog-title">
              <strong>모델 선택</strong>
              <span>업스케일링에 사용할 API 모델</span>
            </div>
            <div className="ai-model-list">
              {AI_MODEL_OPTIONS.map(option => {
                const isSelected = selectedAiModelOption.id === option.id;
                const hasKey = Boolean(getApiKeyForModelOption(option, gptApiKey, geminiApiKey));
                return (
                  <div
                    role="button"
                    tabIndex={hasKey ? 0 : -1}
                    aria-disabled={hasKey ? "false" : "true"}
                    className={`ai-model-option ${isSelected ? "selected" : ""} ${hasKey ? "" : "disabled"}`}
                    key={option.id}
                    onClick={() => {
                      if (hasKey) {
                        setSelectedAiModelId(option.id);
                      }
                    }}
                    onKeyDown={event => {
                      if (!hasKey) {
                        return;
                      }
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedAiModelId(option.id);
                      }
                    }}
                  >
                    <span>{option.label}</span>
                    <strong>{option.detail}</strong>
                    {!hasKey && <em>{option.provider === "gemini" ? "Gemini API Key 필요" : "GPT API Key 필요"}</em>}
                  </div>
                );
              })}
            </div>
            {!selectedAiModelHasKey && (
              <p className="ai-model-help">
                선택한 모델의 API Key를 설정에서 먼저 입력해주세요.
              </p>
            )}
            <div className="ai-model-dialog-actions">
              <ControlButton className="secondary ai-model-cancel" onClick={closeAiModelDialog} disabled={busy}>
                취소
              </ControlButton>
              <ControlButton className="primary ai-model-start" onClick={() => startAiUpscaleWithModel(selectedAiModelOption.id)} disabled={busy || !selectedAiModelHasKey}>
                시작
              </ControlButton>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const stitcherController = new PanelController(() => <App />, {
  id: "stitcher",
  menuItems: [
    { id: "reload", label: "Reload Plugin", enabled: true, checked: false, oninvoke: () => location.reload() }
  ]
});

entrypoints.setup({
  plugin: {
    create() {},
    destroy() {}
  },
  panels: {
    stitcher: stitcherController
  }
});
