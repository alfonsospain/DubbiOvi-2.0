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
        createBodyCell('Entorno ejecutable de aplicación (Desktop App Shell)', 30, COLOR_GRAY_BG),
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
        createBodyCell('Librería de interfaz de usuario (UI Frontend)', 30, COLOR_GRAY_BG),
        createLinkCell('github.com/facebook/react', 'https://github.com/facebook/react', 24, COLOR_GRAY_BG),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('whisper.cpp', 18, 'FFFFFF', true),
        createBodyCell('1.9.1', 10, 'FFFFFF'),
        createBodyCell('MIT', 18, 'FFFFFF'),
        createBodyCell('Proceso externo independiente (whisper-cli) descargado bajo demanda', 30, 'FFFFFF'),
        createLinkCell('github.com/ggml-org/whisper.cpp', 'https://github.com/ggml-org/whisper.cpp', 24, 'FFFFFF'),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('Sharp', 18, COLOR_GRAY_BG, true),
        createBodyCell('0.33.4', 10, COLOR_GRAY_BG),
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
              new TextRun({ text: 'DubbiOvi 2.0 Workstation Edition — Universidad de Oviedo', bold: true, size: 24, color: COLOR_SECONDARY }),
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
              new TextRun({ text: 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.', size: 19 }),
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
              new TextRun({ text: 'Copyright (c) 2024 Vercel, Inc.\n\n', size: 20, bold: true }),
              new TextRun({ text: 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.', size: 19 }),
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
              new TextRun({ text: 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.', size: 19 }),
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
              new TextRun({ text: 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.', size: 19 }),
            ],
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
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
              new TextRun({ text: 'El paquete Sharp (publicado bajo Apache License 2.0, Copyright 2013 Lovell Fuller and contributors) se utiliza en el proyecto exclusivamente como una dependencia de desarrollo (devDependency) durante el proceso de compilación para la generación de los iconos de la aplicación (scripts/generate-icon.js).\n\nConforme a la configuración de empaquetado de Electron (electron-builder.json5), el paquete Sharp y sus módulos derivados se excluyen explícitamente del paquete ejecutable distribuido a los usuarios finales. No se distribuye el binario de Sharp a los usuarios.\n\nNota institucional: Este hallazgo verificado requiere actualizar la fila correspondiente a Sharp/libvips en la plantilla de registro de software de la OTC para reflejar su estado no distribuido en tiempo de compilación.', size: 20, color: COLOR_TEXT }),
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
              new TextRun({ text: 'Tras la verificación técnica detallada de la arquitectura de distribución y las reglas de filtrado de paquetes de Electron (electron-builder.json5), se confirma que las librerías binarias nativas precompiladas de libvips (!node_modules/@img/**/*, !node_modules/**/*.dylib, !node_modules/**/*.node) son excluidas explícitamente del empaquetado final de DubbiOvi.\n\nEn consecuencia, DubbiOvi NO distribuye la librería libvips a los usuarios finales. Por ello, no resultan aplicables las cláusulas de distribución ni las obligaciones de enlace dinámico de la licencia LGPL-3.0 para esta librería en la aplicación distribuida.', size: 20, color: COLOR_TEXT }),
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
              new TextRun({ text: 'Este programa distribuye e invoca binarios independientes de FFmpeg/FFprobe (versión 8.1.2), compilados con las opciones --enable-gpl --enable-version3, por lo que se distribuyen bajo la GNU General Public License, versión 3 o posterior (GPL-3.0-or-later).\n\n', size: 20 }),
              new TextRun({ text: '• Builds utilizados:\n', bold: true, size: 20 }),
              new TextRun({ text: '  - macOS: FFmpeg 8.1.2-tessus de Evermeet (bin/ffmpeg, bin/ffprobe en extraResources)\n  - Windows: FFmpeg 8.1.2 Essentials Build de gyan.dev (bin/ffmpeg.exe, bin/ffprobe.exe en extraResources)\n\n', size: 19 }),
              new TextRun({ text: '• Modo de integración: ', bold: true, size: 20 }),
              new TextRun({ text: 'Proceso externo independiente, invocado mediante child_process.spawn. No existe enlace estático ni dinámico entre el código de DubbiOvi y las librerías de FFmpeg.\n\n', size: 19 }),
              new TextRun({ text: '• Repositorios de código fuente correspondientes:\n', bold: true, size: 20 }),
              new TextRun({ text: '  - Evermeet (macOS): ', size: 19 }),
              createLinkRun('https://evermeet.cx/ffmpeg/', 'https://evermeet.cx/ffmpeg/'),
              new TextRun({ text: '\n  - gyan.dev (Windows): ', size: 19 }),
              createLinkRun('https://www.gyan.dev/ffmpeg/builds/', 'https://www.gyan.dev/ffmpeg/builds/'),
              new TextRun({ text: '\n  - Repositorio oficial FFmpeg: ', size: 19 }),
              createLinkRun('https://github.com/FFmpeg/FFmpeg', 'https://github.com/FFmpeg/FFmpeg'),
              new TextRun({ text: '\n\n• Aviso sobre patentes de códecs: ', bold: true, size: 20 }),
              new TextRun({ text: 'El procesamiento de determinados códecs de audio/video (p. ej. H.264/AVC, H.265/HEVC) puede estar sujeto a patentes de terceros. El cumplimiento de la licencia GPL no exime de posibles obligaciones de licencia de patente para uso comercial.', size: 19 }),
            ],
            spaceAfter: 140,
          }),
          createCallout(
            'ESTADO DE CUMPLIMIENTO GPL (SECCIÓN 6): REQUIERE REVISIÓN / ACCIÓN PENDIENTE PRE-LANZAMIENTO',
            'DubbiOvi redistribuye ejecutables precompilados de FFmpeg bajo GPL-3.0. El mecanismo exacto de entrega del Código Fuente Correspondiente (Corresponding Source) y reproducibilidad de builds conforme a la Sección 6 de la GPL-3.0 queda clasificado como un ítem de REQUIERE REVISIÓN / ACCIÓN PENDIENTE PRE-LANZAMIENTO que se formalizará de forma definitiva antes de la distribución pública oficial.'
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
              new TextRun({ text: 'DubbiOvi permite la descarga bajo demanda e interacción con el motor de síntesis de voz Piper (versión 1.6.0, proyecto OHF-Voice/piper1-gpl), publicado bajo la licencia GNU General Public License v3.0 o posterior.\n\n', size: 20 }),
              new TextRun({ text: '• Modo de integración: ', bold: true, size: 20 }),
              new TextRun({ text: 'Proceso externo independiente, ejecutado como binario CLI mediante child_process.spawn. No existen importaciones de código (import piper_tts) ni bindings de Python o C++ en el código fuente de DubbiOvi.\n\n', size: 19 }),
              new TextRun({ text: '• Código fuente upstream: ', bold: true, size: 20 }),
              createLinkRun('https://github.com/OHF-Voice/piper1-gpl/releases/tag/v1.6.0', 'https://github.com/OHF-Voice/piper1-gpl/releases/tag/v1.6.0'),
              new TextRun({ text: '\n', size: 19 }),
            ],
            spaceAfter: 140,
          }),
          createCallout(
            'ESTADO DE CUMPLIMIENTO GPL (SECCIÓN 6): REQUIERE REVISIÓN / ACCIÓN PENDIENTE PRE-LANZAMIENTO',
            'El mecanismo formal de disponibilidad del Código Fuente Correspondiente (Corresponding Source) para los paquetes de runtime descargables de Piper se mantiene clasificado como REQUIERE REVISIÓN / ACCIÓN PENDIENTE PRE-LANZAMIENTO.'
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
              new TextRun({ text: 'La arquitectura de integración verificada —que ejecuta FFmpeg y Piper como procesos binarios independientes mediante child_process.spawn, con aislamiento en el límite de proceso y sin enlace estático, dinámico ni bindings de código— sustenta el tratamiento de FFmpeg y Piper como componentes independientes cuyo cumplimiento de la GPL se gestiona de forma separada al código propio de DubbiOvi.', size: 20, color: COLOR_TEXT }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '10. Archivos de Licencia Completos en el Repositorio (/licenses/)', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'En el directorio de la distribución /licenses/ se acompañan los textos completos oficiales sin abreviar de las licencias aplicables a los componentes efectivamente distribuidos con DubbiOvi:\n\n', size: 20 }),
              new TextRun({ text: '• /licenses/MIT.txt — Licencia MIT\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/APACHE-2.0.txt — Apache License, Version 2.0\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/GPL-3.0.txt — GNU General Public License v3.0\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/BSD-2-CLAUSE.txt — BSD 2-Clause License\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/BSD-3-CLAUSE.txt — BSD 3-Clause License\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/ISC.txt — ISC License\n\n', size: 19, bold: true }),
              new TextRun({ text: 'Nota: No se incluye el archivo LGPL-3.0.txt al haberse verificado que no se distribuye ningún componente o librería bajo licencia LGPL en la aplicación empaquetada.', size: 19, italic: true }),
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
        createHeaderCell('Upstream Source', 24),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('Electron', 18, COLOR_GRAY_BG, true),
        createBodyCell('31.7.7', 10, COLOR_GRAY_BG),
        createBodyCell('MIT', 18, COLOR_GRAY_BG),
        createBodyCell('Desktop application runtime shell (App Shell)', 30, COLOR_GRAY_BG),
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
        createBodyCell('User interface rendering library (UI Frontend)', 30, COLOR_GRAY_BG),
        createLinkCell('github.com/facebook/react', 'https://github.com/facebook/react', 24, COLOR_GRAY_BG),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('whisper.cpp', 18, 'FFFFFF', true),
        createBodyCell('1.9.1', 10, 'FFFFFF'),
        createBodyCell('MIT', 18, 'FFFFFF'),
        createBodyCell('Independent on-demand CLI subprocess (whisper-cli)', 30, 'FFFFFF'),
        createLinkCell('github.com/ggml-org/whisper.cpp', 'https://github.com/ggml-org/whisper.cpp', 24, 'FFFFFF'),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('Sharp', 18, COLOR_GRAY_BG, true),
        createBodyCell('0.33.4', 10, COLOR_GRAY_BG),
        createBodyCell('Apache-2.0', 18, COLOR_GRAY_BG),
        createBodyCell('Build-time devDependency for icon generation. NOT distributed.', 30, COLOR_GRAY_BG),
        createLinkCell('github.com/lovell/sharp', 'https://github.com/lovell/sharp', 24, COLOR_GRAY_BG),
      ],
    }),
    new TableRow({
      children: [
        createBodyCell('FFmpeg', 18, 'FFFFFF', true),
        createBodyCell('8.1.2', 10, 'FFFFFF'),
        createBodyCell('GPL-3.0-or-later', 18, 'FFFFFF'),
        createBodyCell('Standalone binary subprocess (extraResources binaries)', 30, 'FFFFFF'),
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
              new TextRun({ text: 'DubbiOvi 2.0 Workstation Edition — University of Oviedo', bold: true, size: 24, color: COLOR_SECONDARY }),
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
              new TextRun({ text: 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.', size: 19 }),
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
              new TextRun({ text: 'Copyright (c) 2024 Vercel, Inc.\n\n', size: 20, bold: true }),
              new TextRun({ text: 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.', size: 19 }),
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
              new TextRun({ text: 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.', size: 19 }),
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
              new TextRun({ text: 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.', size: 19 }),
            ],
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
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
              new TextRun({ text: 'The Sharp package (Apache License 2.0, Copyright 2013 Lovell Fuller and contributors) is utilized in the repository strictly as a development dependency (devDependency) for build-time icon generation (scripts/generate-icon.js).\n\nIn accordance with Electron packaging configuration (electron-builder.json5), Sharp and its native binary modules are explicitly excluded from application distribution builds. Sharp is not shipped to end users.\n\nInstitutional Note: This verified finding requires updating the corresponding Sharp/libvips entry in the institutional OTC software registration form to reflect its non-distributed, build-time status.', size: 20, color: COLOR_TEXT }),
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
              new TextRun({ text: 'Technical verification of Electron packaging filters (electron-builder.json5) confirms that pre-compiled native libvips binaries (!node_modules/@img/**/*, !node_modules/**/*.dylib, !node_modules/**/*.node) are omitted from distribution packages.\n\nConsequently, DubbiOvi does NOT distribute libvips binaries to end users. LGPL-3.0 dynamic linking and substitution provisions do not apply to the distributed application.', size: 20, color: COLOR_TEXT }),
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
              new TextRun({ text: 'DubbiOvi redistributes pre-compiled standalone FFmpeg/FFprobe binaries (version 8.1.2) compiled with --enable-gpl --enable-version3, licensed under GPL-3.0-or-later.\n\n', size: 20 }),
              new TextRun({ text: '• Binary Builds Shipped:\n', bold: true, size: 20 }),
              new TextRun({ text: '  - macOS: FFmpeg 8.1.2-tessus from Evermeet (bin/ffmpeg, bin/ffprobe in extraResources)\n  - Windows: FFmpeg 8.1.2 Essentials Build from gyan.dev (bin/ffmpeg.exe, bin/ffprobe.exe in extraResources)\n\n', size: 19 }),
              new TextRun({ text: '• Integration Architecture: ', bold: true, size: 20 }),
              new TextRun({ text: 'Executed as isolated external binary subprocesses via Node.js child_process.spawn. No static or dynamic library linking exists between DubbiOvi code and FFmpeg libraries.\n\n', size: 19 }),
              new TextRun({ text: '• Upstream Repositories:\n', bold: true, size: 20 }),
              new TextRun({ text: '  - Evermeet (macOS): ', size: 19 }),
              createLinkRun('https://evermeet.cx/ffmpeg/', 'https://evermeet.cx/ffmpeg/'),
              new TextRun({ text: '\n  - gyan.dev (Windows): ', size: 19 }),
              createLinkRun('https://www.gyan.dev/ffmpeg/builds/', 'https://www.gyan.dev/ffmpeg/builds/'),
              new TextRun({ text: '\n  - Official FFmpeg Repository: ', size: 19 }),
              createLinkRun('https://github.com/FFmpeg/FFmpeg', 'https://github.com/FFmpeg/FFmpeg'),
              new TextRun({ text: '\n\n• Codec Patent Disclaimer: ', bold: true, size: 20 }),
              new TextRun({ text: 'Processing certain media codecs (such as H.264/AVC, H.265/HEVC) may involve third-party patent portfolios. Open-source software license compliance does not replace patent licensing obligations for commercial usage.', size: 19 }),
            ],
            spaceAfter: 140,
          }),
          createCallout(
            'GPL SECTION 6 COMPLIANCE STATUS: REQUIRES REVIEW / PENDING PRE-RELEASE COMPLIANCE ACTION',
            'DubbiOvi redistributes pre-compiled FFmpeg binaries under GPL-3.0. The exact Corresponding Source delivery and build-reproducibility mechanism under GPL-3.0 Section 6 remains classified as a REQUIRES REVIEW / PENDING PRE-RELEASE COMPLIANCE ACTION that will be finalized prior to official public distribution.'
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
              new TextRun({ text: 'DubbiOvi enables on-demand downloading and execution of the Piper Neural Text-to-Speech runtime (version 1.6.0, OHF-Voice/piper1-gpl project), licensed under GPL-3.0-or-later.\n\n', size: 20 }),
              new TextRun({ text: '• Integration Architecture: ', bold: true, size: 20 }),
              new TextRun({ text: 'Executed as an isolated CLI binary process via child_process.spawn. No Python/C++ code imports (import piper_tts) or language bindings exist in DubbiOvi codebase.\n\n', size: 19 }),
              new TextRun({ text: '• Upstream Source: ', bold: true, size: 20 }),
              createLinkRun('https://github.com/OHF-Voice/piper1-gpl/releases/tag/v1.6.0', 'https://github.com/OHF-Voice/piper1-gpl/releases/tag/v1.6.0'),
              new TextRun({ text: '\n', size: 19 }),
            ],
            spaceAfter: 140,
          }),
          createCallout(
            'GPL SECTION 6 COMPLIANCE STATUS: REQUIRES REVIEW / PENDING PRE-RELEASE COMPLIANCE ACTION',
            'The formal Corresponding Source delivery mechanism for downloaded Piper runtime archives remains classified as a REQUIRES REVIEW / PENDING PRE-RELEASE COMPLIANCE ACTION.'
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
              new TextRun({ text: 'The verified integration architecture — running FFmpeg and Piper as independent binary executables via child_process.spawn, with process boundary isolation and no static/dynamic linking or language bindings — supports treating FFmpeg and Piper as separate components whose GPL compliance is managed independently from DubbiOvi\'s own codebase.', size: 20, color: COLOR_TEXT }),
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
              new TextRun({ text: '• /licenses/MIT.txt — MIT License\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/APACHE-2.0.txt — Apache License, Version 2.0\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/GPL-3.0.txt — GNU General Public License v3.0\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/BSD-2-CLAUSE.txt — BSD 2-Clause License\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/BSD-3-CLAUSE.txt — BSD 3-Clause License\n', size: 19, bold: true }),
              new TextRun({ text: '• /licenses/ISC.txt — ISC License\n\n', size: 19, bold: true }),
              new TextRun({ text: 'Note: LGPL-3.0.txt is omitted because no LGPL-covered native libraries or modules are shipped.', size: 19, italic: true }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '11. Production NPM Dependencies Compliance Inventory', bold: true, size: 24, color: COLOR_PRIMARY })],
            heading: HeadingLevel.HEADING_2,
            spaceBefore: 240,
            spaceAfter: 120,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'DubbiOvi uses direct and transitive open-source Node.js npm packages for its production runtime. The vast majority are distributed under permissive open-source licenses, principally MIT, Apache-2.0, ISC, and BSD-2-Clause / BSD-3-Clause. Full machine-readable inventories containing complete dependency trees, exact SPDX license identifiers, repository links, and resolved package metadata are maintained at:\n- docs/licenses/npm-licenses.json\n- docs/licenses/npm-licenses.csv\n\n', size: 20 }),
              new TextRun({ text: 'Dual-License Elections:\n', bold: true, size: 20 }),
              new TextRun({ text: '• jszip: Dual-licensed MIT / GPL-3.0-or-later. Relied upon under MIT.\n', size: 19 }),
              new TextRun({ text: '• node-forge: Dual-licensed BSD-3-Clause / GPL-2.0. Relied upon under BSD-3-Clause.\n', size: 19 }),
              new TextRun({ text: '• json-schema: Dual-licensed AFL-2.1 / BSD-3-Clause. Relied upon under BSD-3-Clause.\n', size: 19 }),
            ],
            spaceAfter: 200,
          }),

          new Paragraph({
            children: [new TextRun({ text: '12. AI Models and Synthetic Voice Licensing', bold: true, size: 24, color: COLOR_PRIMARY })],
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

// Generate both documents under docs/licenses/
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
