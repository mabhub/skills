#!/usr/bin/env python3
"""
Script de validation automatique pour fichiers TL;DR.
Vérifie longueur, structure, front-matter et qualité du contenu.
"""

import sys
import re
import yaml
from pathlib import Path
from typing import Dict, List, Tuple


class TLDRValidator:
    """Validateur de fichiers TL;DR."""

    # Limites
    MAX_WORDS = 750
    MAX_READING_TIME_MIN = 3.0
    WORDS_PER_MINUTE = 250  # Français
    MAX_PARAGRAPH_WORDS = 150

    # Champs requis front-matter
    REQUIRED_FIELDS = ['created', 'source', 'author']

    def __init__(self, filepath: str):
        self.filepath = Path(filepath)
        self.content = ""
        self.frontmatter = {}
        self.body = ""
        self.warnings = []
        self.errors = []

    def load_file(self) -> bool:
        """Charge le fichier TL;DR."""
        try:
            self.content = self.filepath.read_text(encoding='utf-8')
            return True
        except Exception as e:
            self.errors.append(f"Impossible de lire le fichier: {e}")
            return False

    def extract_frontmatter(self) -> bool:
        """Extrait et parse le front-matter YAML."""
        # Pattern pour front-matter YAML
        pattern = r'^---\s*\n(.*?)\n---\s*\n(.*)$'
        match = re.match(pattern, self.content, re.DOTALL)

        if not match:
            self.errors.append("Front-matter YAML non trouvé ou mal formaté")
            return False

        yaml_str, self.body = match.groups()

        try:
            self.frontmatter = yaml.safe_load(yaml_str)
            return True
        except yaml.YAMLError as e:
            self.errors.append(f"Erreur de parsing YAML: {e}")
            return False

    def validate_frontmatter(self) -> None:
        """Valide le contenu du front-matter."""
        # Champs requis
        for field in self.REQUIRED_FIELDS:
            if field not in self.frontmatter:
                self.errors.append(f"Champ requis manquant dans front-matter: '{field}'")

        # Tags recommandés
        if 'tags' not in self.frontmatter:
            self.warnings.append("Aucun tag défini (recommandé: 3-10 tags)")
        elif isinstance(self.frontmatter['tags'], list):
            tag_count = len(self.frontmatter['tags'])
            if tag_count < 3:
                self.warnings.append(f"Peu de tags ({tag_count}), recommandé: 3-10")
            elif tag_count > 10:
                self.warnings.append(f"Beaucoup de tags ({tag_count}), recommandé: 3-10")

    def count_words(self, text: str) -> int:
        """Compte les mots dans un texte."""
        # Retire les balises markdown et compte les mots
        text_clean = re.sub(r'[#*`\[\]()_-]', ' ', text)
        words = text_clean.split()
        return len(words)

    def validate_length(self) -> Tuple[int, float]:
        """Valide la longueur du TL;DR."""
        word_count = self.count_words(self.body)
        reading_time = word_count / self.WORDS_PER_MINUTE

        if word_count > self.MAX_WORDS:
            self.errors.append(
                f"Trop de mots: {word_count}/{self.MAX_WORDS} "
                f"(temps de lecture: {reading_time:.1f} min)"
            )
        elif word_count > self.MAX_WORDS * 0.9:
            self.warnings.append(
                f"Proche de la limite: {word_count}/{self.MAX_WORDS} mots"
            )

        return word_count, reading_time

    def validate_structure(self) -> None:
        """Valide la structure du document."""
        # Vérifier titre principal
        if not re.search(r'^# .+TL;?DR', self.body, re.MULTILINE | re.IGNORECASE):
            self.warnings.append("Titre principal ne contient pas 'TL;DR'")

        # Vérifier résumé exécutif
        if not re.search(r'## Résumé [eé]xécutif', self.body, re.IGNORECASE):
            self.warnings.append("Section 'Résumé exécutif' non trouvée")

        # Vérifier hiérarchie titres
        h1_count = len(re.findall(r'^# ', self.body, re.MULTILINE))
        if h1_count == 0:
            self.errors.append("Aucun titre H1 trouvé")
        elif h1_count > 1:
            self.warnings.append(f"Plusieurs titres H1 ({h1_count}), un seul recommandé")

        # Vérifier H4+ (trop de niveaux)
        if re.search(r'^#### ', self.body, re.MULTILINE):
            self.warnings.append("Hiérarchie profonde détectée (H4+), max H3 recommandé")

    def validate_paragraphs(self) -> None:
        """Valide la longueur des paragraphes."""
        # Séparer en paragraphes (blocs non vides)
        paragraphs = re.split(r'\n\s*\n', self.body)

        for i, para in enumerate(paragraphs, 1):
            # Ignorer titres, listes, code
            if re.match(r'^(#{1,3} |[-*+] |`|>)', para.strip()):
                continue

            word_count = self.count_words(para)
            if word_count > self.MAX_PARAGRAPH_WORDS:
                # Trouver numéro de ligne approximatif
                line_num = self.content[:self.content.find(para)].count('\n')
                self.warnings.append(
                    f"Paragraphe ligne ~{line_num}: {word_count} mots "
                    f"(recommandé < {self.MAX_PARAGRAPH_WORDS})"
                )

    def validate_links(self) -> None:
        """Valide la syntaxe des liens."""
        # Trouver tous les liens markdown
        links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', self.body)

        for text, url in links:
            # Vérifier syntaxe basique URL
            if not url.strip():
                self.warnings.append(f"Lien vide pour texte: '{text}'")
            elif not re.match(r'^(https?://|#)', url):
                self.warnings.append(f"URL potentiellement invalide: '{url}'")

    def validate_encoding(self) -> None:
        """Vérifie les problèmes d'encodage."""
        # Caractères problématiques
        problematic = re.findall(r'[��\ufffd]', self.content)
        if problematic:
            self.errors.append(
                f"Problèmes d'encodage détectés: {len(problematic)} caractères invalides"
            )

    def validate(self) -> bool:
        """Exécute toutes les validations."""
        if not self.load_file():
            return False

        if not self.extract_frontmatter():
            return False

        # Validations
        self.validate_frontmatter()
        word_count, reading_time = self.validate_length()
        self.validate_structure()
        self.validate_paragraphs()
        self.validate_links()
        self.validate_encoding()

        # Afficher résultats
        self._print_results(word_count, reading_time)

        return len(self.errors) == 0

    def _print_results(self, word_count: int, reading_time: float) -> None:
        """Affiche les résultats de validation."""
        if not self.errors and not self.warnings:
            print("✅ Validation réussie")
            print(f"   - Mots: {word_count}/{self.MAX_WORDS}")
            print(f"   - Temps de lecture: {reading_time:.1f} min")
            print(f"   - Front-matter: valide")
            print(f"   - Structure: correcte")
        else:
            if self.errors:
                print("❌ Erreurs bloquantes:")
                for error in self.errors:
                    print(f"   - {error}")

            if self.warnings:
                print("\n⚠️  Avertissements (non bloquants):")
                for warning in self.warnings:
                    print(f"   - {warning}")

            if not self.errors:
                print("\n✅ Validation réussie avec avertissements")
                print(f"   - Mots: {word_count}/{self.MAX_WORDS}")
                print(f"   - Temps de lecture: {reading_time:.1f} min")


def main():
    """Point d'entrée du script."""
    if len(sys.argv) != 2:
        print("Usage: python validate_tldr.py <fichier.tldr.md>")
        sys.exit(1)

    filepath = sys.argv[1]

    if not Path(filepath).exists():
        print(f"❌ Fichier non trouvé: {filepath}")
        sys.exit(1)

    validator = TLDRValidator(filepath)
    success = validator.validate()

    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
