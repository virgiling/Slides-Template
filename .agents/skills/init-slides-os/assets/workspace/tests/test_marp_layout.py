"""Opt-in native PDF regression checks; text/vector data only, no browser tools."""

import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(os.environ.get('MARP_TEST_PDF') == '1', 'opt in with MARP_TEST_PDF=1 (native PDF compiler + Poppler)')
class MarpLayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        for command in ('pdftotext', 'pdftocairo'):
            if not shutil.which(command):
                raise unittest.SkipTest(f'{command} is required for PDF layout checks')
        temporary = tempfile.TemporaryDirectory(prefix='marp-layout-test-')
        cls.addClassCleanup(temporary.cleanup)
        cls.work = Path(temporary.name)
        for name in ('example.md', 'theme.css', 'assets/workflow.svg', 'assets/aigc-badge.png'):
            target = cls.work / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / 'template/marp' / name, target)
        command = [str(ROOT / 'node_modules/.bin/marp'), 'example.md', '--no-config-file', '--no-html',
                   '--engine', str(ROOT / 'scripts/marp-engine.cjs'), '--theme', 'theme.css',
                   '--pdf', '--allow-local-files', '-o', 'example.pdf']
        result = subprocess.run(command, cwd=cls.work, env={**os.environ, 'TMPDIR': str(cls.work)},
                                text=True, capture_output=True, timeout=180)
        if result.returncode:
            raise RuntimeError(result.stderr[-4000:])
        pdf = str(cls.work / 'example.pdf')
        xml = subprocess.check_output(['pdftotext', '-bbox', pdf, '-'], timeout=30)
        cls.pages = ET.fromstring(xml).findall('.//{*}page')
        subprocess.run(['pdftocairo', '-svg', '-f', '2', '-l', '2', pdf, str(cls.work / 'footer.svg')],
                       check=True, capture_output=True, timeout=30)
        cls.vector = ET.parse(cls.work / 'footer.svg')

    def test_image_and_explanation_are_in_separate_columns_inside_page(self):
        page = self.pages[6]
        width, height = float(page.attrib['width']), float(page.attrib['height'])
        words = page.findall('.//{*}word')
        for word in words:
            self.assertGreaterEqual(float(word.attrib['xMin']), -0.5, word.text)
            self.assertLessEqual(float(word.attrib['xMax']), width + 0.5, word.text)
            self.assertLessEqual(float(word.attrib['yMax']), height + 0.5, word.text)
        labels = {word.text: word for word in words}
        self.assertLess(float(labels['assets/workflow.svg'].attrib['xMax']), width / 2)
        for label in ('Markdown', 'HTML'):
            self.assertGreater(float(labels[label].attrib['xMin']), width / 2)
            self.assertLess(float(labels[label].attrib['yMax']), height - 40)

    def test_footer_band_is_painted_full_width_and_footer_text_is_over_it(self):
        self.assertEqual(len(self.pages), 9)
        width, height = (float(self.pages[1].attrib[key]) for key in ('width', 'height'))
        # The original empty display:table pseudo-element painted no gradient.
        gradients = self.vector.findall('.//{*}linearGradient')
        self.assertEqual(len(gradients), 1, 'the bottom band must actually be painted into the PDF')
        gradient = gradients[0]
        matrix = [float(n) for n in re.findall(r'-?\d+(?:\.\d+)?', gradient.attrib['gradientTransform'])]
        self.assertEqual(len(matrix), 6)
        self.assertAlmostEqual(float(gradient.attrib['x2']) * matrix[0] + matrix[4], width, delta=1)
        band_top = matrix[5]
        self.assertGreater(band_top, height * 0.9, 'band belongs at the bottom, never the top')
        self.assertLess(band_top, height - 20)
        reference = f"url(#{gradient.attrib['id']})"
        self.assertTrue(any(reference in value for element in self.vector.iter() for value in element.attrib.values()))
        for index, page in enumerate(self.pages, 1):
            footer = [w for w in page.findall('.//{*}word') if float(w.attrib['yMin']) >= band_top]
            text = ' '.join(w.text or '' for w in footer)
            self.assertIn('Your Name', text)
            self.assertIn('Group Seminar', text)
            for word in footer:
                self.assertLessEqual(float(word.attrib['yMax']), height)
            number = ''.join(w.text or '' for w in footer if float(w.attrib['xMin']) > width * 0.8)
            self.assertEqual(number, '' if index == 1 else f'{index}/9')


if __name__ == '__main__':
    unittest.main()
