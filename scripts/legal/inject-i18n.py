#!/usr/bin/env python3
"""Inject /privacy and /terms i18n namespaces into all 4 locale JSON files.

Re-runnable: each run replaces the `privacy` and `terms` keys in each locale.
English is the source; DE/FR/AR are convenience translations (the in-page
notice tells users the English version governs in case of discrepancy).

Run from the repo root:
    python scripts/legal/inject-i18n.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
I18N = ROOT / "src" / "i18n"

# Common keys shared by both pages (per locale)
COMMON = {
    "en": {
        "lastUpdated": "Last updated",
        "lastUpdatedValue": "30 May 2026",
        "effective": "Effective",
        "effectiveValue": "30 May 2026",
        "noticeTitle": "Important",
        "translationNotice": "Translations are provided for convenience. In case of discrepancy, the English version governs.",
        "legalNotice": "This document describes the platform's policy and is not legal advice.",
        "tocLabel": "Contents",
    },
    "de": {
        "lastUpdated": "Zuletzt aktualisiert",
        "lastUpdatedValue": "30. Mai 2026",
        "effective": "In Kraft seit",
        "effectiveValue": "30. Mai 2026",
        "noticeTitle": "Hinweis",
        "translationNotice": "Übersetzungen werden zur Erleichterung bereitgestellt. Bei Abweichungen ist die englische Fassung maßgeblich.",
        "legalNotice": "Dieses Dokument beschreibt die Richtlinie der Plattform und stellt keine Rechtsberatung dar.",
        "tocLabel": "Inhalt",
    },
    "fr": {
        "lastUpdated": "Dernière mise à jour",
        "lastUpdatedValue": "30 mai 2026",
        "effective": "Entrée en vigueur",
        "effectiveValue": "30 mai 2026",
        "noticeTitle": "À noter",
        "translationNotice": "Les traductions sont fournies pour votre confort. En cas de divergence, la version anglaise prévaut.",
        "legalNotice": "Ce document décrit la politique de la plateforme et ne constitue pas un avis juridique.",
        "tocLabel": "Sommaire",
    },
    "ar": {
        "lastUpdated": "آخر تحديث",
        "lastUpdatedValue": "30 مايو 2026",
        "effective": "تاريخ السريان",
        "effectiveValue": "30 مايو 2026",
        "noticeTitle": "ملاحظة مهمة",
        "translationNotice": "تُقدَّم الترجمات للتسهيل، وعند وجود اختلاف تكون النسخة الإنجليزية هي المرجع.",
        "legalNotice": "يصف هذا المستند سياسة المنصّة ولا يُعدّ استشارة قانونية.",
        "tocLabel": "المحتويات",
    },
}

# Per-page meta (title / intro / contactFooter)
META = {
    "en": {
        "privacy": {
            "title": "Privacy Policy",
            "intro": "This Privacy Policy explains how XportACar collects, uses and protects personal data when you use our website, mobile apps and related services.",
            "contactFooter": "Questions? Email support@xportacar.com or write to Global Business Consultancy L.L.C-FZ, Meydan Grandstand, 6th floor, Meydan Road, Nad Al Sheba, Dubai, UAE.",
        },
        "terms": {
            "title": "Terms of Service",
            "intro": "These Terms of Service govern your use of the XportACar website, mobile apps and related services. By creating an account or using the platform you agree to these terms.",
            "contactFooter": "For questions about these Terms, email support@xportacar.com.",
        },
    },
    "de": {
        "privacy": {
            "title": "Datenschutzerklärung",
            "intro": "Diese Datenschutzerklärung erläutert, wie XportACar personenbezogene Daten erhebt, verwendet und schützt, wenn Sie unsere Website, mobilen Apps und damit verbundenen Dienste nutzen.",
            "contactFooter": "Fragen? Schreiben Sie an support@xportacar.com oder an Global Business Consultancy L.L.C-FZ, Meydan Grandstand, 6. Etage, Meydan Road, Nad Al Sheba, Dubai, VAE.",
        },
        "terms": {
            "title": "Nutzungsbedingungen",
            "intro": "Diese Nutzungsbedingungen regeln Ihre Nutzung der Website, der mobilen Apps und der zugehörigen Dienste von XportACar. Mit der Erstellung eines Kontos oder der Nutzung der Plattform stimmen Sie ihnen zu.",
            "contactFooter": "Fragen zu diesen Bedingungen? Schreiben Sie an support@xportacar.com.",
        },
    },
    "fr": {
        "privacy": {
            "title": "Politique de confidentialité",
            "intro": "Cette politique de confidentialité explique comment XportACar collecte, utilise et protège les données personnelles lorsque vous utilisez notre site web, nos applications mobiles et services associés.",
            "contactFooter": "Des questions ? Écrivez à support@xportacar.com ou à Global Business Consultancy L.L.C-FZ, Meydan Grandstand, 6e étage, Meydan Road, Nad Al Sheba, Dubaï, EAU.",
        },
        "terms": {
            "title": "Conditions générales d'utilisation",
            "intro": "Les présentes Conditions générales régissent votre utilisation du site, des applications mobiles et des services associés de XportACar. En créant un compte ou en utilisant la plateforme, vous les acceptez.",
            "contactFooter": "Des questions sur ces conditions ? Écrivez à support@xportacar.com.",
        },
    },
    "ar": {
        "privacy": {
            "title": "سياسة الخصوصية",
            "intro": "توضّح سياسة الخصوصية هذه كيف تقوم XportACar بجمع البيانات الشخصية واستخدامها وحمايتها عند استخدام موقعنا وتطبيقاتنا المتنقلة والخدمات ذات الصلة.",
            "contactFooter": "أسئلة؟ راسلنا على support@xportacar.com أو على Global Business Consultancy L.L.C-FZ، Meydan Grandstand، الطابق السادس، شارع ميدان، ند الشبا، دبي، الإمارات.",
        },
        "terms": {
            "title": "شروط الخدمة",
            "intro": "تنظّم شروط الخدمة هذه استخدامك لموقع XportACar وتطبيقاتها المتنقّلة والخدمات ذات الصلة. بإنشاء حساب أو استخدام المنصّة فإنك توافق على هذه الشروط.",
            "contactFooter": "أسئلة حول هذه الشروط؟ راسلنا على support@xportacar.com.",
        },
    },
}

# Section bodies live in sibling files (sections_<locale>.py) to keep this
# script readable. Each exports PRIVACY (list of (title, body)) and TERMS.
from sections_en import PRIVACY as EN_PRIVACY, TERMS as EN_TERMS  # noqa: E402
from sections_de import PRIVACY as DE_PRIVACY, TERMS as DE_TERMS  # noqa: E402
from sections_fr import PRIVACY as FR_PRIVACY, TERMS as FR_TERMS  # noqa: E402
from sections_ar import PRIVACY as AR_PRIVACY, TERMS as AR_TERMS  # noqa: E402

SECTIONS = {
    "en": {"privacy": EN_PRIVACY, "terms": EN_TERMS},
    "de": {"privacy": DE_PRIVACY, "terms": DE_TERMS},
    "fr": {"privacy": FR_PRIVACY, "terms": FR_TERMS},
    "ar": {"privacy": AR_PRIVACY, "terms": AR_TERMS},
}


def build_namespace(locale: str, page: str) -> dict:
    ns = dict(COMMON[locale])
    ns.update(META[locale][page])
    for i, (title, body) in enumerate(SECTIONS[locale][page], start=1):
        ns[f"s{i}Title"] = title
        ns[f"s{i}Body"] = body
    return ns


def main():
    for locale in ("en", "de", "fr", "ar"):
        fp = I18N / f"{locale}.json"
        data = json.loads(fp.read_text(encoding="utf-8"))
        for page in ("privacy", "terms"):
            data[page] = build_namespace(locale, page)
        fp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"updated {fp.relative_to(ROOT)}  (privacy={len(data['privacy'])} keys, terms={len(data['terms'])} keys)")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    main()
