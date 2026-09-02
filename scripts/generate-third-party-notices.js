/**
 * DubbiOvi 2.0 — Third-Party Notices Document Generator
 * Generates both Spanish (institutional OTC) and English (public GitHub)
 * human-readable Microsoft Word (.docx) compliance documents under docs/licenses/.
 * 
 * Includes native Word clickable ExternalHyperlink objects for all URLs.
 */

const fs = require('fs');
const path = require('path');
const docx = require('docx');

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ExternalHyperlink,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  AlignmentType,
} = docx;

// Styling constants
const COLOR_PRIMARY = '002B49';     // Navy
const COLOR_SECONDARY = '005A9C';   // Blue
const COLOR_LINK = '005A9C';        // Hyperlink Blue
const COLOR_ALERT_BG = 'FFF8E1';    // Amber callout
const COLOR_ALERT_BORDER = 'FFA000';
const COLOR_GRAY_BG = 'F4F6F8';
const COLOR_TEXT = '222222';

const CANONICAL_MIT_TEXT =
  'Permission is hereby granted, free of charge, to any person obtaining a copy ' +
  'of this software and associated documentation files (the "Software"), to deal ' +
  'in the Software without restriction, including without limitation the rights ' +
  'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell ' +
  'copies of the Software, and to permit persons to whom the Software is ' +
  'furnished to do so, subject to the following conditions:\n\n' +
  'The above copyright notice and this permission notice shall be included in all ' +
  'copies or substantial portions of the Software.\n\n' +
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR ' +
  'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, ' +
  'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE ' +
  'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER ' +
  'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, ' +
  'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE ' +
  'SOFTWARE.';

function createHeaderCell(text, widthPercent) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20 })],
        alignment: AlignmentType.LEFT,
      }),
    ],
    shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    padding: { top: 120, bottom: 120, left: 140, right: 140 },
  });
}

function createBodyCell(text, widthPercent, bg = 'FFFFFF', bold = false) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 19, bold, color: COLOR_TEXT })],
      }),
    ],
    shading: { fill: bg, type: ShadingType.CLEAR },
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    padding: { top: 100, bottom: 100, left: 140, right: 140 },
  });
}

function createLinkCell(displayText, targetUrl, widthPercent, bg = 'FFFFFF') {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new ExternalHyperlink({
            children: [
              new TextRun({
                text: displayText,
                size: 19,
                color: COLOR_LINK,
                underline: { type: 'single' },
              }),
            ],
            link: targetUrl,
          }),
        ],
      }),
    ],
    shading: { fill: bg, type: ShadingType.CLEAR },
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    padding: { top: 100, bottom: 100, left: 140, right: 140 },
  });
}

function createLinkRun(displayText, targetUrl) {
  return new ExternalHyperlink({
    children: [
      new TextRun({
        text: displayText,
        size: 19,
        color: COLOR_LINK,
        underline: { type: 'single' },
      }),
    ],
    link: targetUrl,
  });
}

function createCallout(titleText, bodyText) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: titleText, bold: true, color: 'B78103', size: 21 })],
                spaceAfter: 80,
              }),
              new Paragraph({
                children: [new TextRun({ text: bodyText, size: 20, color: COLOR_TEXT })],
              }),
            ],
            shading: { fill: COLOR_ALERT_BG, type: ShadingType.CLEAR },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              left: { style: BorderStyle.SINGLE, size: 24, color: COLOR_ALERT_BORDER },
            },
            padding: { top: 140, bottom: 140, left: 200, right: 140 },
          }),
        ],
      }),
    ],
  });
}

/**
 * Generates the Spanish institutional Word document (DubbiOvi_2.0_Avisos_de_Terceros_OTC.docx)
 */
function generateSpanishDoc(targetPath) {
  const summaryRows = [
    new TableRow({
      children: [
        createHeaderCell('Componente', 18),
        createHeaderCell('Versión', 10),
        createHeaderCell('Licencia', 18),
        createHeaderCell('Modo de integración', 30),
        createHeaderCell('Fuente / Repositorio', 24),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('Electron', 18, COLOR_GRAY_BG, true),
        createBodyCell('31.7.7', 10, COLOR_GRAY_BG),
        createBodyCell('MIT', 18, COLOR_GRAY_BG),
        createBodyCell('Framework de aplicación de escritorio', 30, COLOR_GRAY_BG),
        createLinkCell('github.com/electron/electron', 'https://github.com/electron/electron', 24, COLOR_GRAY_BG),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('Next.js', 18, 'FFFFFF', true),
        createBodyCell('15.3.8', 10, 'FFFFFF'),
        createBodyCell('MIT', 18, 'FFFFFF'),
        createBodyCell('Framework web compilado (.next/standalone)', 30, 'FFFFFF'),
        createLinkCell('github.com/vercel/next.js', 'https://github.com/vercel/next.js', 24, 'FFFFFF'),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('React / React DOM', 18, COLOR_GRAY_BG, true),
        createBodyCell('18.3.1', 10, COLOR_GRAY_BG),
        createBodyCell('MIT', 18, COLOR_GRAY_BG),
        createBodyCell('Librería de interfaz de usuario', 30, COLOR_GRAY_BG),
        createLinkCell('github.com/facebook/react', 'https://github.com/facebook/react', 24, COLOR_GRAY_BG),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('whisper.cpp', 18, 'FFFFFF', true),
        createBodyCell('v1.9.1', 10, 'FFFFFF'),
        createBodyCell('MIT', 18, 'FFFFFF'),
        createBodyCell('Motor de transcripción local (ejecutable whisper-cli)', 30, 'FFFFFF'),
        createLinkCell('github.com/ggerganov/whisper.cpp', 'https://github.com/ggerganov/whisper.cpp', 24, 'FFFFFF'),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('Sharp', 18, COLOR_GRAY_BG, true),
        createBodyCell('v0.33.4', 10, COLOR_GRAY_BG),
        createBodyCell('Apache-2.0', 18, COLOR_GRAY_BG),
        createBodyCell('Herramienta de desarrollo (devDependency) para compilación de iconos. NO distribuido.', 30, COLOR_GRAY_BG),
        createLinkCell('github.com/lovell/sharp', 'https://github.com/lovell/sharp', 24, COLOR_GRAY_BG),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('FFmpeg', 18, 'FFFFFF', true),
        createBodyCell('8.1.2', 10, 'FFFFFF'),
        createBodyCell('GPL-3.0-or-later', 18, 'FFFFFF'),
        createBodyCell('Proceso externo independiente (binarios en extraResources)', 30, 'FFFFFF'),
        createLinkCell('ffmpeg.org', 'https://ffmpeg.org', 24, 'FFFFFF'),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('Piper (runtime)', 18, COLOR_GRAY_BG, true),
        createBodyCell('1.6.0', 10, COLOR_GRAY_BG),
        createBodyCell('GPL-3.0-or-later', 18, COLOR_GRAY_BG),
        createBodyCell('Proceso externo independiente (piper1-gpl) descargado bajo demanda', 30, COLOR_GRAY_BG),
        createLinkCell('github.com/OHF-Voice/piper1-gpl', 'https://github.com/OHF-Voice/piper1-gpl', 24, COLOR_GRAY_BG),
      ],
    }),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'AVISOS DE TERCEROS (THIRD-PARTY NOTICES)', bold: true, size: 32, color: COLOR_PRIMARY }),
            ],
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'DubbiOvi 2.0 — Universidad de Oviedo', bold: true, size: 24, color: COLOR_SECONDARY }),
            ],
            spaceAfter: 240,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Este software incluye o distribuye componentes de terceros bajo sus propias licencias, independientes de la licencia aplicable a este programa. A continuación se listan dichos componentes, sus versiones exactas, avisos de derechos de autor y las obligaciones de licencias asociadas.', size: 21, color: COLOR_TEXT }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: 'Resumen de Componentes Principales', bold: true, size: 26, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 200,
            spaceAfter: 140,
          }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: summaryRows }),
          new Paragraph({ text: '', spaceAfter: 240 }),

          new Paragraph({
            children: [new TextRun({ text: '1. Electron 31.7.7 — MIT License', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Copyright (c) Electron contributors\nCopyright (c) 2013-2020 GitHub Inc.\n\n', size: 20, bold: true }),
              new TextRun({ text: '• Upstream: ', bold: true, size: 20 }),
              createLinkRun('https://github.com/electron/electron', 'https://github.com/electron/electron'),
              new TextRun({ text: '\n• Licencia: ', bold: true, size: 20 }),
              new TextRun({ text: 'MIT License (SPDX: MIT)\n', size: 19 }),
              new TextRun({ text: '• Texto de la licencia: ', bold: true, size: 20 }),
              new TextRun({ text: 'Texto completo oficial disponible en /licenses/MIT.txt\n', size: 19, italic: true }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '2. Next.js 15.3.8 — MIT License', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Copyright (c) 2025 Vercel, Inc.\n\n', size: 20, bold: true }),
              new TextRun({ text: '• Upstream: ', bold: true, size: 20 }),
              createLinkRun('https://github.com/vercel/next.js', 'https://github.com/vercel/next.js'),
              new TextRun({ text: '\n• Licencia: ', bold: true, size: 20 }),
              new TextRun({ text: 'MIT License (SPDX: MIT)\n', size: 19 }),
              new TextRun({ text: '• Texto de la licencia: ', bold: true, size: 20 }),
              new TextRun({ text: 'Texto completo oficial disponible en /licenses/MIT.txt\n', size: 19, italic: true }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '3. React / React DOM 18.3.1 — MIT License', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Copyright (c) Meta Platforms, Inc. and affiliates.\n\n', size: 20, bold: true }),
              new TextRun({ text: '• Upstream: ', bold: true, size: 20 }),
              createLinkRun('https://github.com/facebook/react', 'https://github.com/facebook/react'),
              new TextRun({ text: '\n• Licencia: ', bold: true, size: 20 }),
              new TextRun({ text: 'MIT License (SPDX: MIT)\n', size: 19 }),
              new TextRun({ text: '• Texto de la licencia: ', bold: true, size: 20 }),
              new TextRun({ text: 'Texto completo oficial disponible en /licenses/MIT.txt\n', size: 19, italic: true }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '4. whisper.cpp v1.9.1 — MIT License', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Copyright (c) 2023-2026 Georgi Gerganov / The ggml authors\n\n', size: 20, bold: true }),
              new TextRun({ text: '• Upstream: ', bold: true, size: 20 }),
              createLinkRun('https://github.com/ggerganov/whisper.cpp', 'https://github.com/ggerganov/whisper.cpp'),
              new TextRun({ text: '\n• Licencia: ', bold: true, size: 20 }),
              new TextRun({ text: 'MIT License (SPDX: MIT)\n', size: 19 }),
              new TextRun({ text: '• Texto de la licencia: ', bold: true, size: 20 }),
              new TextRun({ text: 'Texto completo oficial disponible en /licenses/MIT.txt\n\n', size: 19, italic: true }),
              new TextRun({ text: 'Nota técnica de integración: whisper.cpp se ejecuta exclusivamente como un proceso externo independiente (ejecutable whisper-cli) descargado bajo demanda en el directorio de usuario. No se enlaza de forma estática ni dinámica con el código fuente de la aplicación. Se utiliza únicamente el núcleo C++ ejecutable del repositorio upstream. El archivo opcional de ejemplo examples/ffmpeg-transcode.cpp (distribuido bajo GPL-2.0 en el repositorio upstream) no se compila ni se incluye en la distribución.', size: 19, italic: true, color: COLOR_TEXT }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '5. Sharp (v0.33.4) — Herramienta de desarrollo (Apache-2.0)', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'El paquete Sharp (publicado bajo Apache License 2.0, Copyright 2013 Lovell Fuller and contributors) se utiliza en el proyecto exclusivamente como una dependencia de desarrollo (devDependency) durante el proceso de compilación para la generación de los iconos de la aplicación (scripts/generate-icon.js).\n\nConforme a la configuración de empaquetado de Electron (electron-builder.json5), el paquete Sharp y sus módulos derivados se excluyen explícitamente del paquete ejecutable distribuido a los usuarios finales.\n\nLa inspección directa del artefacto inspeccionado para macOS (.app y DMG) no encontró archivos de Sharp, @img, libvips, módulos binarios nativos .node de Sharp ni librerías .dylib asociadas. La verificación del artefacto empaquetado final para Windows permanece pendiente hasta la disponibilidad de dicho ejecutable empaquetado.', size: 20, color: COLOR_TEXT }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '6. Librería libvips — Estado de distribución (No distribuido)', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'La inspección técnica directa de los artefactos de distribución confirma que las librerías binarias nativas precompiladas de libvips (!node_modules/@img/**/*, !node_modules/**/*.dylib, !node_modules/**/*.node) son excluidas explícitamente del empaquetado final de DubbiOvi.\n\nEn consecuencia, DubbiOvi NO distribuye la librería libvips a los usuarios finales. Por ello, no resultan aplicables las cláusulas de distribución ni las obligaciones de enlace dinámico de la licencia LGPL-3.0 para esta librería en la aplicación distribuida.', size: 20, color: COLOR_TEXT }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '7. FFmpeg 8.1.2 — GPL-3.0-or-later', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'DubbiOvi 2.0 distribuye FFmpeg y FFprobe como ejecutables independientes para funciones de procesamiento audiovisual.\n\n', size: 20 }),
              new TextRun({ text: 'Los binarios utilizados proceden de builds públicos de Evermeet/Tessus para macOS y gyan.dev para Windows. Durante la preparación de la distribución se contactó directamente con ambos proveedores para verificar información relativa a la procedencia, configuración, modificaciones conocidas y bibliotecas externas de sus respectivos builds.\n\n', size: 20 }),
              new TextRun({ text: 'Los proveedores facilitaron o confirmaron la información disponible sobre las configuraciones utilizadas y las modificaciones conocidas. Determinados detalles internos de sus procesos de compilación no se encuentran publicados, ya que sus scripts de build son privados.\n\n', size: 20 }),
              new TextRun({ text: 'Para el build de macOS, Evermeet mantiene además información histórica sobre las bibliotecas externas utilizadas mediante su API pública. Las modificaciones conocidas downstream facilitadas por Tessus se conservan como archivos de parche/diff en los materiales técnicos de código fuente. Para el build de Windows, Gyan confirmó que sus scripts de compilación son privados y que no se aplican parches downstream a FFmpeg ni a sus bibliotecas externas.\n\n', size: 20 }),
              new TextRun({ text: 'DubbiOvi distribuye por separado materiales de código fuente, parches, información de procedencia y documentación técnica recopilados para los componentes GPL redistribuidos.\n\n', size: 20 }),
              new TextRun({ text: '• Upstream: ', bold: true, size: 20 }),
              new TextRun({ text: 'FFmpeg (', size: 19 }),
              createLinkRun('https://ffmpeg.org', 'https://ffmpeg.org'),
              new TextRun({ text: ' / ', size: 19 }),
              createLinkRun('https://github.com/FFmpeg/FFmpeg', 'https://github.com/FFmpeg/FFmpeg'),
              new TextRun({ text: ')\n', size: 19 }),
              new TextRun({ text: '• Builds utilizados:\n', bold: true, size: 20 }),
              new TextRun({ text: '  - macOS: Evermeet / Tessus (', size: 19 }),
              createLinkRun('https://evermeet.cx/ffmpeg/', 'https://evermeet.cx/ffmpeg/'),
              new TextRun({ text: ')\n  - Windows: gyan.dev (', size: 19 }),
              createLinkRun('https://www.gyan.dev/ffmpeg/builds/', 'https://www.gyan.dev/ffmpeg/builds/'),
              new TextRun({ text: ')\n', size: 19 }),
              new TextRun({ text: '• Licencia: ', bold: true, size: 20 }),
              new TextRun({ text: 'GPL-3.0-or-later\n', size: 19 }),
              new TextRun({ text: '• Texto completo: ', bold: true, size: 20 }),
              new TextRun({ text: '/licenses/GPL-3.0.txt\n\n', size: 19 }),
              new TextRun({ text: 'Aviso sobre patentes de códecs: ', bold: true, size: 20 }),
              new TextRun({ text: 'El procesamiento de determinados códecs de audio/video (p. ej. H.264/AVC, H.265/HEVC) puede estar sujeto a patentes de terceros. El cumplimiento de la licencia de software libre no exime de posibles obligaciones de licencia de patente para uso comercial.', size: 19 }),
            ],
            spaceAfter: 140,
          }),
          createCallout(
            'MATERIALES DE CÓDIGO FUENTE Y PROCEDENCIA (ARTÍCULO 6 DE LA GPL-3.0)',
            'Los materiales recopilados relativos a la redistribución de FFmpeg 8.1.2 se suministran como un archivo independiente denominado DubbiOvi-2.0.0-GPL-Corresponding-Source.tar.xz. Este paquete reúne código fuente upstream, parches, parámetros de configuración, información de procedencia y otros materiales técnicos recopilados para los componentes redistribuidos.'
          ),
          new Paragraph({ text: '', spaceAfter: 200 }),

          new Paragraph({
            children: [new TextRun({ text: '8. Piper 1.6.0 (runtime) — GPL-3.0-or-later', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'DubbiOvi 2.0 permite la descarga bajo demanda e interacción con el motor de síntesis de voz Piper (versión interna 1.6.0, proyecto OHF-Voice/piper1-gpl), publicado bajo la licencia GNU General Public License v3.0 o posterior.\n\n', size: 20 }),
              new TextRun({ text: '• Modo de integración: ', bold: true, size: 20 }),
              new TextRun({ text: 'Proceso externo independiente, ejecutado como binario CLI mediante child_process.spawn. No existen importaciones de código (import piper_tts) ni bindings de Python o C++ en el código fuente de DubbiOvi.\n\n', size: 19 }),
              new TextRun({ text: '• Procedencia y especificación de empaquetado: ', bold: true, size: 20 }),
              new TextRun({ text: 'El runtime ejecutable de producción se basa en la versión 1.6.0 de OHF-Voice/piper1-gpl (etiqueta v1.6.0, commit f04d52c5528ac7cf2d73757f57990ff490f75005). PyInstaller specification preserved from the DubbiOvi Piper 1.6.0 packaging workspace; exact single-build linkage to the distributed production binary could not be independently re-verified.\n\n', size: 19 }),
              new TextRun({ text: '• Código fuente upstream: ', bold: true, size: 20 }),
              createLinkRun('https://github.com/OHF-Voice/piper1-gpl/releases/tag/v1.6.0', 'https://github.com/OHF-Voice/piper1-gpl/releases/tag/v1.6.0'),
              new TextRun({ text: '\n• Licencia: ', bold: true, size: 20 }),
              new TextRun({ text: 'GPL-3.0-or-later\n', size: 19 }),
              new TextRun({ text: '• Texto completo: ', bold: true, size: 20 }),
              new TextRun({ text: '/licenses/GPL-3.0.txt\n', size: 19 }),
            ],
            spaceAfter: 140,
          }),
          createCallout(
            'MATERIALES DE CÓDIGO FUENTE Y PROCEDENCIA (ARTÍCULO 6 DE LA GPL-3.0)',
            'Los materiales de código fuente y procedencia correspondientes al motor Piper 1.6.0 se distribuyen de forma independiente junto con la documentación técnica disponible dentro del paquete DubbiOvi-2.0.0-GPL-Corresponding-Source.tar.xz. Estos materiales incluyen el código fuente upstream correspondiente a Piper 1.6.0, la especificación PyInstaller preservada, las instrucciones de empaquetado y la documentación de procedencia disponible.'
          ),
          new Paragraph({ text: '', spaceAfter: 200 }),

          new Paragraph({
            children: [new TextRun({ text: '9. Arquitectura de Integración de Procesos Externos (FFmpeg y Piper)', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'La arquitectura de integración verificada —que ejecuta FFmpeg y Piper como procesos binarios independientes mediante child_process.spawn, con aislamiento en el límite de proceso y sin enlace estático, dinámico ni bindings de código— sustenta el tratamiento de FFmpeg y Piper como componentes independientes cuyos materiales de código fuente GPL se gestionan de forma separada al código propio de DubbiOvi.', size: 20, color: COLOR_TEXT }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '10. Archivos de Licencia Oficiales en el Repositorio (/licenses/)', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'En el directorio de la distribución /licenses/ se acompañan los textos completos oficiales sin abreviar de las licencias aplicables a los componentes distribuidos con DubbiOvi:\n\n', size: 20 }),
              new TextRun({ text: '• /licenses/MIT.txt — Licencia MIT (texto completo canonical reproducido a continuación)\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/APACHE-2.0.txt — Apache License, Version 2.0\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/GPL-3.0.txt — GNU General Public License v3.0\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/BSD-2-CLAUSE.txt — BSD 2-Clause License\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/BSD-3-CLAUSE.txt — BSD 3-Clause License\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/ISC.txt — ISC License\n\n', size: 19, bold: true }),
              new TextRun({ text: 'Nota: No se incluye el archivo LGPL-3.0.txt al haberse verificado que no se distribuye ningún componente o librería bajo licencia LGPL en la aplicación empaquetada.\n\n', size: 19, italic: true }),
              new TextRun({ text: 'Texto canónico oficial de la Licencia MIT (/licenses/MIT.txt):\n\n', bold: true, size: 20 }),
              new TextRun({ text: CANONICAL_MIT_TEXT, size: 19 }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '11. Inventario de Dependencias npm de Producción', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'DubbiOvi utiliza dependencias npm directas y transitivas. La gran mayoría se distribuyen bajo licencias permisivas de código abierto, principalmente MIT, Apache-2.0, ISC y BSD. El inventario auditado completo se mantiene en docs/licenses/npm-licenses.json y docs/licenses/npm-licenses.csv.\n\n', size: 20 }),
              new TextRun({ text: 'Declaración de elección en paquetes con doble licencia:\n', bold: true, size: 20 }),
              new TextRun({ text: '• jszip: Doble licencia MIT / GPL-3.0-or-later. DubbiOvi hace uso del paquete bajo los términos permisivos de la licencia MIT.\n', size: 19 }),
              new TextRun({ text: '• node-forge: Doble licencia BSD-3-Clause / GPL-2.0. DubbiOvi hace uso del paquete bajo la licencia BSD-3-Clause.\n', size: 19 }),
              new TextRun({ text: '• json-schema: Doble licencia AFL-2.1 / BSD-3-Clause. DubbiOvi hace uso del paquete bajo la licencia BSD-3-Clause.\n', size: 19 }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '12. Licencias de Modelos de Inteligencia Artificial y Voces', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Los pesos de modelos de IA y voces sintéticas se distribuyen y descargan de forma independiente a los ejecutables de software:\n\n', size: 20 }),
              new TextRun({ text: '• Modelos Whisper (ggml-*.bin): ', bold: true, size: 20 }),
              new TextRun({ text: 'Licencia MIT (Copyright OpenAI / ggerganov).\n', size: 19 }),
              new TextRun({ text: '• Modelos de Voz Piper (*.onnx, *.onnx.json): ', bold: true, size: 20 }),
              new TextRun({ text: 'Cada modelo de voz individual en rhasspy/piper-voices cuenta con su propia licencia de dataset (CC0-1.0, CC-BY-4.0, Open Data) detallada en su archivo descriptor .onnx.json.\n', size: 19 }),
            ],
            spaceAfter: 200,
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync(targetPath, buffer);
    console.log('[Spanish Document] Generated successfully at:', targetPath);
  });
}

/**
 * Generates the English public-facing Word document (DubbiOvi_2.0_Third-Party_Notices.docx)
 */
function generateEnglishDoc(targetPath) {
  const summaryRows = [
    new TableRow({
      children: [
        createHeaderCell('Component', 18),
        createHeaderCell('Version', 10),
        createHeaderCell('License', 18),
        createHeaderCell('Integration Architecture', 30),
        createHeaderCell('Source / Repository', 24),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('Electron', 18, COLOR_GRAY_BG, true),
        createBodyCell('31.7.7', 10, COLOR_GRAY_BG),
        createBodyCell('MIT', 18, COLOR_GRAY_BG),
        createBodyCell('Desktop application framework runtime', 30, COLOR_GRAY_BG),
        createLinkCell('github.com/electron/electron', 'https://github.com/electron/electron', 24, COLOR_GRAY_BG),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('Next.js', 18, 'FFFFFF', true),
        createBodyCell('15.3.8', 10, 'FFFFFF'),
        createBodyCell('MIT', 18, 'FFFFFF'),
        createBodyCell('Standalone web framework (.next/standalone)', 30, 'FFFFFF'),
        createLinkCell('github.com/vercel/next.js', 'https://github.com/vercel/next.js', 24, 'FFFFFF'),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('React / React DOM', 18, COLOR_GRAY_BG, true),
        createBodyCell('18.3.1', 10, COLOR_GRAY_BG),
        createBodyCell('MIT', 18, COLOR_GRAY_BG),
        createBodyCell('User interface rendering library', 30, COLOR_GRAY_BG),
        createLinkCell('github.com/facebook/react', 'https://github.com/facebook/react', 24, COLOR_GRAY_BG),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('whisper.cpp', 18, 'FFFFFF', true),
        createBodyCell('v1.9.1', 10, 'FFFFFF'),
        createBodyCell('MIT', 18, 'FFFFFF'),
        createBodyCell('Local speech recognition engine (whisper-cli executable)', 30, 'FFFFFF'),
        createLinkCell('github.com/ggerganov/whisper.cpp', 'https://github.com/ggerganov/whisper.cpp', 24, 'FFFFFF'),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('Sharp', 18, COLOR_GRAY_BG, true),
        createBodyCell('v0.33.4', 10, COLOR_GRAY_BG),
        createBodyCell('Apache-2.0', 18, COLOR_GRAY_BG),
        createBodyCell('Build-time development tool (devDependency) for icon generation. NOT distributed.', 30, COLOR_GRAY_BG),
        createLinkCell('github.com/lovell/sharp', 'https://github.com/lovell/sharp', 24, COLOR_GRAY_BG),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('FFmpeg', 18, 'FFFFFF', true),
        createBodyCell('8.1.2', 10, 'FFFFFF'),
        createBodyCell('GPL-3.0-or-later', 18, 'FFFFFF'),
        createBodyCell('Isolated external subprocess (binaries in extraResources)', 30, 'FFFFFF'),
        createLinkCell('ffmpeg.org', 'https://ffmpeg.org', 24, 'FFFFFF'),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('Piper (runtime)', 18, COLOR_GRAY_BG, true),
        createBodyCell('1.6.0', 10, COLOR_GRAY_BG),
        createBodyCell('GPL-3.0-or-later', 18, COLOR_GRAY_BG),
        createBodyCell('Independent on-demand CLI subprocess (piper1-gpl)', 30, COLOR_GRAY_BG),
        createLinkCell('github.com/OHF-Voice/piper1-gpl', 'https://github.com/OHF-Voice/piper1-gpl', 24, COLOR_GRAY_BG),
      ],
    }),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'THIRD-PARTY SOFTWARE NOTICES AND LICENSES', bold: true, size: 32, color: COLOR_PRIMARY }),
            ],
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'DubbiOvi 2.0 — University of Oviedo', bold: true, size: 24, color: COLOR_SECONDARY }),
            ],
            spaceAfter: 240,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'This application includes or redistributes open-source third-party software components. Each component remains subject to its respective copyright notices and open-source license terms. The software license governing DubbiOvi itself does not alter or supersede the licenses of these third-party components.', size: 21, color: COLOR_TEXT }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: 'Core Component Inventory Summary', bold: true, size: 26, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 200,
            spaceAfter: 140,
          }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: summaryRows }),
          new Paragraph({ text: '', spaceAfter: 240 }),

          new Paragraph({
            children: [new TextRun({ text: '1. Electron 31.7.7 — MIT License', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Copyright (c) Electron contributors\nCopyright (c) 2013-2020 GitHub Inc.\n\n', size: 20, bold: true }),
              new TextRun({ text: '• Upstream: ', bold: true, size: 20 }),
              createLinkRun('https://github.com/electron/electron', 'https://github.com/electron/electron'),
              new TextRun({ text: '\n• License: ', bold: true, size: 20 }),
              new TextRun({ text: 'MIT License (SPDX: MIT)\n', size: 19 }),
              new TextRun({ text: '• License Text: ', bold: true, size: 20 }),
              new TextRun({ text: 'Full official text available at /licenses/MIT.txt\n', size: 19, italic: true }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '2. Next.js 15.3.8 — MIT License', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Copyright (c) 2025 Vercel, Inc.\n\n', size: 20, bold: true }),
              new TextRun({ text: '• Upstream: ', bold: true, size: 20 }),
              createLinkRun('https://github.com/vercel/next.js', 'https://github.com/vercel/next.js'),
              new TextRun({ text: '\n• License: ', bold: true, size: 20 }),
              new TextRun({ text: 'MIT License (SPDX: MIT)\n', size: 19 }),
              new TextRun({ text: '• License Text: ', bold: true, size: 20 }),
              new TextRun({ text: 'Full official text available at /licenses/MIT.txt\n', size: 19, italic: true }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '3. React / React DOM 18.3.1 — MIT License', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Copyright (c) Meta Platforms, Inc. and affiliates.\n\n', size: 20, bold: true }),
              new TextRun({ text: '• Upstream: ', bold: true, size: 20 }),
              createLinkRun('https://github.com/facebook/react', 'https://github.com/facebook/react'),
              new TextRun({ text: '\n• License: ', bold: true, size: 20 }),
              new TextRun({ text: 'MIT License (SPDX: MIT)\n', size: 19 }),
              new TextRun({ text: '• License Text: ', bold: true, size: 20 }),
              new TextRun({ text: 'Full official text available at /licenses/MIT.txt\n', size: 19, italic: true }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '4. whisper.cpp v1.9.1 — MIT License', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Copyright (c) 2023-2026 Georgi Gerganov / The ggml authors\n\n', size: 20, bold: true }),
              new TextRun({ text: '• Upstream: ', bold: true, size: 20 }),
              createLinkRun('https://github.com/ggerganov/whisper.cpp', 'https://github.com/ggerganov/whisper.cpp'),
              new TextRun({ text: '\n• License: ', bold: true, size: 20 }),
              new TextRun({ text: 'MIT License (SPDX: MIT)\n', size: 19 }),
              new TextRun({ text: '• License Text: ', bold: true, size: 20 }),
              new TextRun({ text: 'Full official text available at /licenses/MIT.txt\n\n', size: 19, italic: true }),
              new TextRun({ text: 'Technical Integration Note: whisper.cpp operates strictly as an independent external process (whisper-cli binary executable) downloaded on demand into user application storage. It is not statically or dynamically linked into DubbiOvi codebase. Only the C++ core executable is utilized; the optional upstream example file examples/ffmpeg-transcode.cpp (GPL-2.0) is neither compiled nor distributed.', size: 19, italic: true, color: COLOR_TEXT }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '5. Sharp (v0.33.4) — Build-Time Development Tool (Apache-2.0)', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'The Sharp package (Apache License 2.0, Copyright 2013 Lovell Fuller and contributors) is utilized in the repository strictly as a development dependency (devDependency) for build-time icon generation (scripts/generate-icon.js).\n\nIn accordance with Electron packaging configuration (electron-builder.json5), Sharp and its native binary modules are explicitly excluded from application distribution builds. Sharp is not shipped to end users.\n\nDirect inspection of the inspected macOS .app and DMG found no Sharp, @img, libvips, native Sharp .node, or related .dylib files. Final artifact verification for Windows remains pending until a packaged Windows executable artifact is available.', size: 20, color: COLOR_TEXT }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '6. libvips Library — Non-Distributed Status', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Direct technical verification of distribution artifacts confirms that pre-compiled native libvips binaries (!node_modules/@img/**/*, !node_modules/**/*.dylib, !node_modules/**/*.node) are omitted from distribution packages.\n\nConsequently, DubbiOvi does NOT distribute libvips binaries to end users. LGPL-3.0 dynamic linking and substitution provisions do not apply to the distributed application.', size: 20, color: COLOR_TEXT }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '7. FFmpeg 8.1.2 — GPL-3.0-or-later', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'DubbiOvi 2.0 distributes FFmpeg and FFprobe as independent executables for audiovisual processing functions.\n\n', size: 20 }),
              new TextRun({ text: 'The binaries used originate from public builds provided by Evermeet/Tessus for macOS and gyan.dev for Windows. During preparation of the distribution, both providers were contacted directly to verify available information concerning provenance, configuration, known modifications, and external libraries used in their respective builds.\n\n', size: 20 }),
              new TextRun({ text: 'The providers supplied or confirmed the available information concerning build configuration and known modifications. Certain internal details of their build processes are not publicly available because their custom build scripts are private.\n\n', size: 20 }),
              new TextRun({ text: 'For the macOS build, Evermeet additionally maintains historical information about external libraries through its public API. Downstream modifications supplied by Tessus are preserved as patch/diff files in the technical source materials. For the Windows build, Gyan confirmed that the custom build scripts are private and that no downstream patches are applied to FFmpeg or its external libraries.\n\n', size: 20 }),
              new TextRun({ text: 'DubbiOvi distributes separately the source materials, patches, provenance information, and technical documentation collected for redistributed GPL components.\n\n', size: 20 }),
              new TextRun({ text: '• Upstream: ', bold: true, size: 20 }),
              new TextRun({ text: 'FFmpeg (', size: 19 }),
              createLinkRun('https://ffmpeg.org', 'https://ffmpeg.org'),
              new TextRun({ text: ' / ', size: 19 }),
              createLinkRun('https://github.com/FFmpeg/FFmpeg', 'https://github.com/FFmpeg/FFmpeg'),
              new TextRun({ text: ')\n', size: 19 }),
              new TextRun({ text: '• Binary Builds Used:\n', bold: true, size: 20 }),
              new TextRun({ text: '  - macOS: Evermeet / Tessus (', size: 19 }),
              createLinkRun('https://evermeet.cx/ffmpeg/', 'https://evermeet.cx/ffmpeg/'),
              new TextRun({ text: ')\n  - Windows: gyan.dev (', size: 19 }),
              createLinkRun('https://www.gyan.dev/ffmpeg/builds/', 'https://www.gyan.dev/ffmpeg/builds/'),
              new TextRun({ text: ')\n', size: 19 }),
              new TextRun({ text: '• License: ', bold: true, size: 20 }),
              new TextRun({ text: 'GPL-3.0-or-later\n', size: 19 }),
              new TextRun({ text: '• Full text: ', bold: true, size: 20 }),
              new TextRun({ text: '/licenses/GPL-3.0.txt\n\n', size: 19 }),
              new TextRun({ text: 'Codec Patent Disclaimer: ', bold: true, size: 20 }),
              new TextRun({ text: 'Processing certain media codecs (such as H.264/AVC, H.265/HEVC) may involve third-party patent portfolios. Open-source software license compliance does not replace patent licensing obligations for commercial usage.', size: 19 }),
            ],
            spaceAfter: 140,
          }),
          createCallout(
            'GPL-3.0 (SECTION 6) SOURCE MATERIALS AND PROVENANCE',
            'The materials collected in connection with the redistribution of FFmpeg 8.1.2 are supplied as a separate package named DubbiOvi-2.0.0-GPL-Corresponding-Source.tar.xz. This package brings together upstream source code, patches, configuration parameters, provenance information, and other technical materials collected for the redistributed components.'
          ),
          new Paragraph({ text: '', spaceAfter: 200 }),

          new Paragraph({
            children: [new TextRun({ text: '8. Piper Neural TTS 1.6.0 (runtime) — GPL-3.0-or-later', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'DubbiOvi 2.0 enables on-demand downloading and execution of the Piper Neural Text-to-Speech runtime (internal version 1.6.0, OHF-Voice/piper1-gpl project), licensed under GPL-3.0-or-later.\n\n', size: 20 }),
              new TextRun({ text: '• Integration Architecture: ', bold: true, size: 20 }),
              new TextRun({ text: 'Executed as an isolated CLI binary process via child_process.spawn. No Python/C++ code imports (import piper_tts) or language bindings exist in the DubbiOvi codebase.\n\n', size: 19 }),
              new TextRun({ text: '• Provenance & Packaging Specification: ', bold: true, size: 20 }),
              new TextRun({ text: 'The production runtime is built from OHF-Voice/piper1-gpl version 1.6.0 (tag v1.6.0, commit f04d52c5528ac7cf2d73757f57990ff490f75005). PyInstaller specification (piper.spec) preserved from the DubbiOvi Piper 1.6.0 packaging workspace; exact single-build linkage to the distributed production binary could not be independently re-verified.\n\n', size: 19 }),
              new TextRun({ text: '• Upstream Source: ', bold: true, size: 20 }),
              createLinkRun('https://github.com/OHF-Voice/piper1-gpl/releases/tag/v1.6.0', 'https://github.com/OHF-Voice/piper1-gpl/releases/tag/v1.6.0'),
              new TextRun({ text: '\n• License: ', bold: true, size: 20 }),
              new TextRun({ text: 'GPL-3.0-or-later\n', size: 19 }),
              new TextRun({ text: '• Full text: ', bold: true, size: 20 }),
              new TextRun({ text: '/licenses/GPL-3.0.txt\n', size: 19 }),
            ],
            spaceAfter: 140,
          }),
          createCallout(
            'GPL-3.0 (SECTION 6) SOURCE MATERIALS AND PROVENANCE',
            'Source and provenance materials corresponding to Piper 1.6.0 are distributed separately together with the available technical documentation within the DubbiOvi-2.0.0-GPL-Corresponding-Source.tar.xz package. These materials include upstream source code corresponding to Piper 1.6.0, the preserved PyInstaller specification, packaging instructions, and available provenance documentation.'
          ),
          new Paragraph({ text: '', spaceAfter: 200 }),

          new Paragraph({
            children: [new TextRun({ text: '9. Subprocess Integration Architecture Notice (FFmpeg & Piper)', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'The verified integration architecture — running FFmpeg and Piper as independent binary executables via child_process.spawn, with process boundary isolation and no static/dynamic linking or language bindings — supports treating FFmpeg and Piper as separate components whose GPL source materials are managed independently from DubbiOvi\'s own codebase.', size: 20, color: COLOR_TEXT }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '10. Verbatim Full License Texts Directory (/licenses/)', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'The root /licenses/ directory of the application distribution contains verbatim official license text files for all distributed third-party components:\n\n', size: 20 }),
              new TextRun({ text: '• /licenses/MIT.txt — MIT License (canonical full license text reproduced below)\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/APACHE-2.0.txt — Apache License, Version 2.0\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/GPL-3.0.txt — GNU General Public License v3.0\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/BSD-2-CLAUSE.txt — BSD 2-Clause License\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/BSD-3-CLAUSE.txt — BSD 3-Clause License\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/ISC.txt — ISC License\n\n', size: 19, bold: true }),
              new TextRun({ text: 'Note: LGPL-3.0.txt is omitted because no LGPL-covered native libraries or modules are shipped.\n\n', size: 19, italic: true }),
              new TextRun({ text: 'Canonical MIT License Full Text (/licenses/MIT.txt):\n\n', bold: true, size: 20 }),
              new TextRun({ text: CANONICAL_MIT_TEXT, size: 19 }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '11. Production npm Dependency Inventory', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'DubbiOvi uses direct and transitive open-source Node.js npm packages for its production runtime. The vast majority are distributed under permissive open-source licenses, principally MIT, Apache-2.0, ISC, and BSD-2-Clause / BSD-3-Clause. Full machine-readable inventories containing complete dependency trees, exact SPDX license identifiers, repository links, and resolved package metadata are maintained at:\n- docs/licenses/npm-licenses.json\n- docs/licenses/npm-licenses.csv\n\n', size: 20 }),
              new TextRun({ text: 'Dual-Licensed Package Election Statements:\n', bold: true, size: 20 }),
              new TextRun({ text: '• jszip: Dual-licensed under MIT / GPL-3.0-or-later. DubbiOvi elects to receive and redistribute under the permissive MIT license.\n', size: 19 }),
              new TextRun({ text: '• node-forge: Dual-licensed under BSD-3-Clause / GPL-2.0. DubbiOvi elects to receive and redistribute under the BSD-3-Clause license.\n', size: 19 }),
              new TextRun({ text: '• json-schema: Dual-licensed under AFL-2.1 / BSD-3-Clause. DubbiOvi elects to receive and redistribute under the BSD-3-Clause license.\n', size: 19 }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '12. AI Models and Synthetic Voice Datasets', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'AI model weights and synthetic voice assets are distributed independently from software runtimes:\n\n', size: 20 }),
              new TextRun({ text: '• Whisper Models (ggml-*.bin): ', bold: true, size: 20 }),
              new TextRun({ text: 'MIT License (Copyright OpenAI / ggerganov).\n', size: 19 }),
              new TextRun({ text: '• Piper Voice Models (*.onnx, *.onnx.json): ', bold: true, size: 20 }),
              new TextRun({ text: 'Each ONNX voice model in rhasspy/piper-voices has an individual dataset license (CC0-1.0, CC-BY-4.0, Open Data) specified in its .onnx.json descriptor file.\n', size: 19 }),
            ],
            spaceAfter: 200,
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync(targetPath, buffer);
    console.log('[English Document] Generated successfully at:', targetPath);
  });
}

// Generate documents under docs/licenses/
const docsLicensesDir = path.join(__dirname, '../docs/licenses');
if (!fs.existsSync(docsLicensesDir)) {
  fs.mkdirSync(docsLicensesDir, { recursive: true });
}

const spanishDocPath = path.join(docsLicensesDir, 'DubbiOvi_2.0_Avisos_de_Terceros_OTC.docx');
const englishDocPath = path.join(docsLicensesDir, 'DubbiOvi_2.0_Third-Party_Notices.docx');

Promise.all([
  generateSpanishDoc(spanishDocPath),
  generateEnglishDoc(englishDocPath),
]).then(() => {
  console.log('All Third-Party Compliance Word Documents generated successfully!');
}).catch((err) => {
  console.error('Error generating Word Documents:', err);
  process.exit(1);
});
