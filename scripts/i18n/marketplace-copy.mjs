// One-off copy migration for the auction → fixed-price marketplace switch
// (2026-10-07). Sets new keys and rewrites bidding/auction copy in all four
// web dictionaries. Idempotent: re-running leaves the files unchanged.
// usage: node scripts/i18n/marketplace-copy.mjs
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..", "src", "i18n");
const LANGS = ["en", "de", "fr", "ar"];
const dicts = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(fs.readFileSync(path.join(DIR, `${l}.json`), "utf8"))]));

function setKey(obj, key, value) {
  const parts = key.split(".");
  let o = obj;
  for (const p of parts.slice(0, -1)) o = o[p] ??= {};
  o[parts.at(-1)] = value;
}
function getKey(obj, key) {
  return key.split(".").reduce((a, p) => (a == null ? a : a[p]), obj);
}
/** set(key, en, de, fr, ar) */
function set(key, en, de, fr, ar) {
  const v = { en, de, fr, ar };
  for (const l of LANGS) setKey(dicts[l], key, v[l]);
}
/** Replace exact substrings inside an existing value; throws if a pattern is missing and not yet applied. */
function patch(key, perLang) {
  for (const l of LANGS) {
    let s = getKey(dicts[l], key);
    if (typeof s !== "string") throw new Error(`${l}:${key} missing`);
    for (const [from, to] of perLang[l]) {
      if (s.includes(from)) s = s.split(from).join(to);
      else if (!s.includes(to)) throw new Error(`${l}:${key} pattern not found: ${from.slice(0, 40)}`);
    }
    setKey(dicts[l], key, s);
  }
}

// ---------------------------------------------------------------- nav / admin
set("nav.myPurchases", "My purchases", "Meine Käufe", "Mes achats", "مشترياتي");
set("admin.statLiveListings", "Live listings", "Aktive Angebote", "Annonces en ligne", "الإعلانات المتاحة");
set("admin.pipelineListed", "Listed", "Angeboten", "En vente", "معروضة");
set("admin.navListings", "Listings", "Angebote", "Annonces", "الإعلانات");

// ---------------------------------------------------------------- listing (buyer fixed-price UI)
set("listing.price", "Price", "Preis", "Prix", "السعر");
set("listing.daysLeft", "{count} days left", "Noch {count} Tage", "Encore {count} jours", "الأيام المتبقية: {count}");
set("listing.lastDay", "Last day", "Letzter Tag", "Dernier jour", "اليوم الأخير");
set("listing.liveBadge", "For sale", "Zu verkaufen", "À vendre", "معروضة للبيع");
set("listing.expired", "Listing ended", "Angebot beendet", "Annonce terminée", "انتهى الإعلان");
set("listing.expiredBody",
  "This listing has ended and is no longer available.",
  "Dieses Angebot ist beendet und nicht mehr verfügbar.",
  "Cette annonce est terminée et n'est plus disponible.",
  "انتهى هذا الإعلان ولم يعد متاحًا.");
set("listing.sold", "Sold", "Verkauft", "Vendu", "تم البيع");
set("listing.soldBody", "This vehicle has been sold.", "Dieses Fahrzeug wurde verkauft.", "Ce véhicule a été vendu.", "تم بيع هذه المركبة.");
set("listing.notListed", "Not currently for sale", "Derzeit nicht im Verkauf", "Pas en vente actuellement", "غير معروضة للبيع حاليًا");
set("listing.notListedBody",
  "This vehicle isn't listed for sale right now.",
  "Dieses Fahrzeug ist derzeit nicht im Verkauf.",
  "Ce véhicule n'est pas en vente pour le moment.",
  "هذه المركبة غير معروضة للبيع حاليًا.");
set("listing.buyNow", "Buy now", "Jetzt kaufen", "Acheter maintenant", "اشترِ الآن");
set("listing.signInToBuy", "Sign in to buy", "Zum Kaufen anmelden", "Connectez-vous pour acheter", "سجّل الدخول للشراء");
set("listing.confirmTitle", "Confirm your purchase", "Kauf bestätigen", "Confirmez votre achat", "تأكيد عملية الشراء");
set("listing.confirmBody",
  "You are buying {vehicle} for {price}. The 2.9% platform fee and your chosen shipping are added on the invoice. Confirming is a binding purchase.",
  "Sie kaufen {vehicle} für {price}. Die Plattformgebühr von 2,9 % und der gewählte Versand werden auf der Rechnung ergänzt. Mit der Bestätigung kaufen Sie verbindlich.",
  "Vous achetez {vehicle} pour {price}. La commission de plateforme de 2,9 % et la livraison choisie s'ajoutent sur la facture. La confirmation vaut achat ferme.",
  "أنت على وشك شراء {vehicle} مقابل {price}. تُضاف رسوم المنصة بنسبة 2.9% وتكلفة الشحن التي تختارها إلى الفاتورة. التأكيد يعني شراءً مُلزِمًا.");
set("listing.confirmCta", "Confirm purchase", "Verbindlich kaufen", "Confirmer l'achat", "تأكيد الشراء");
set("listing.purchaseFailed", "Purchase failed", "Kauf fehlgeschlagen", "L'achat a échoué", "تعذّر إتمام الشراء");
set("listing.purchaseDone", "Purchase confirmed", "Kauf bestätigt", "Achat confirmé", "تم تأكيد الشراء");
set("listing.redirecting", "Taking you to your order…", "Weiter zu Ihrer Bestellung…", "Redirection vers votre commande…", "جارٍ نقلك إلى طلبك…");
set("listing.feeNote",
  "Plus 2.9% platform fee and shipping, invoiced after purchase.",
  "Zzgl. 2,9 % Plattformgebühr und Versand, nach dem Kauf in Rechnung gestellt.",
  "Plus 2,9 % de commission de plateforme et la livraison, facturés après l'achat.",
  "تُضاف رسوم المنصة 2.9% والشحن، وتُفوتر بعد الشراء.");
set("listing.viewOrder", "View your order", "Bestellung ansehen", "Voir votre commande", "عرض طلبك");
set("listing.youBoughtThis", "You bought this vehicle", "Sie haben dieses Fahrzeug gekauft", "Vous avez acheté ce véhicule", "لقد اشتريت هذه المركبة");
set("listing.marketValue", "Market {price}", "Markt {price}", "Marché {price}", "السوق {price}");
set("listing.backToMarketplace", "Back to marketplace", "Zurück zum Marktplatz", "Retour au marché", "العودة إلى السوق");
set("listing.errUnavailable",
  "This listing is no longer available.",
  "Dieses Angebot ist nicht mehr verfügbar.",
  "Cette annonce n'est plus disponible.",
  "هذا الإعلان لم يعد متاحًا.");
set("listing.errGeneric",
  "Something went wrong. Please try again.",
  "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
  "Une erreur s'est produite. Veuillez réessayer.",
  "حدث خطأ ما. يرجى المحاولة مرة أخرى.");
set("listing.errSignIn",
  "Sign in to buy this vehicle.",
  "Melden Sie sich an, um dieses Fahrzeug zu kaufen.",
  "Connectez-vous pour acheter ce véhicule.",
  "سجّل الدخول لشراء هذه المركبة.");

// ---------------------------------------------------------------- purchase / order page
set("purchase.metaTitle", "Your order", "Ihre Bestellung", "Votre commande", "طلبك");
set("purchase.heading", "Purchase confirmed", "Kauf bestätigt", "Achat confirmé", "تم تأكيد الشراء");
set("purchase.headingWonAuction",
  "Congratulations! You won this auction",
  "Glückwunsch! Sie haben diese Auktion gewonnen",
  "Félicitations ! Vous avez remporté cette enchère",
  "تهانينا! لقد فزت بهذا المزاد");
set("purchase.headingClosed", "Listing closed", "Angebot geschlossen", "Annonce close", "تم إغلاق الإعلان");
set("purchase.confirmWithin",
  "Confirm your order within 36 hours to secure this vehicle.",
  "Bestätigen Sie Ihre Bestellung innerhalb von 36 Stunden, um dieses Fahrzeug zu sichern.",
  "Confirmez votre commande sous 36 heures pour réserver ce véhicule.",
  "أكّد طلبك خلال 36 ساعة لضمان حجز هذه المركبة.");
set("purchase.closedBody",
  "This vehicle is no longer available. Keep an eye on the marketplace for similar vehicles.",
  "Dieses Fahrzeug ist nicht mehr verfügbar. Schauen Sie im Marktplatz nach ähnlichen Fahrzeugen.",
  "Ce véhicule n'est plus disponible. Surveillez le marché pour des véhicules similaires.",
  "لم تعد هذه المركبة متاحة. تابع السوق لمركبات مشابهة.");
set("purchase.viewListing", "View listing", "Angebot ansehen", "Voir l'annonce", "عرض الإعلان");
set("purchase.viewDashboard", "View dashboard", "Zum Dashboard", "Voir le tableau de bord", "عرض لوحة التحكم");
set("purchase.vehiclePrice", "Vehicle price", "Fahrzeugpreis", "Prix du véhicule", "سعر المركبة");

// ---------------------------------------------------------------- buyer dashboard
set("dashboard.statPurchases", "Purchases", "Käufe", "Achats", "المشتريات");
set("dashboard.statSpent", "Total spent", "Ausgaben gesamt", "Total dépensé", "إجمالي الإنفاق");
set("dashboard.statUnread", "Unread notifications", "Ungelesene Mitteilungen", "Notifications non lues", "إشعارات غير مقروءة");
set("dashboard.statActiveBids", "Active bids", "Aktive Gebote", "Enchères actives", "مزايدات نشطة");
set("dashboard.statWonAuctions", "Won auctions", "Gewonnene Auktionen", "Enchères remportées", "مزادات فزت بها");
set("dashboard.purchasesTitle", "Your purchases", "Ihre Käufe", "Vos achats", "مشترياتك");
set("dashboard.bidsTitle", "Your bids", "Ihre Gebote", "Vos enchères", "مزايداتك");
set("dashboard.browseLink", "Browse the marketplace", "Zum Marktplatz", "Parcourir le marché", "تصفّح السوق");
set("dashboard.noPurchases", "No purchases yet.", "Noch keine Käufe.", "Aucun achat pour le moment.", "لا توجد مشتريات بعد.");
set("dashboard.noBids", "No bids yet.", "Noch keine Gebote.", "Aucune enchère pour le moment.", "لا توجد مزايدات بعد.");
set("dashboard.colVehicle", "Vehicle", "Fahrzeug", "Véhicule", "المركبة");
set("dashboard.colPrice", "Price", "Preis", "Prix", "السعر");
set("dashboard.colStatus", "Status", "Status", "Statut", "الحالة");
set("dashboard.colWhen", "When", "Wann", "Quand", "التاريخ");
set("dashboard.colTopBid", "Your top bid", "Ihr Höchstgebot", "Votre meilleure enchère", "أعلى مزايدة لك");
set("dashboard.colCurrent", "Current", "Aktuell", "Actuelle", "الحالية");
set("dashboard.statusAwaitingPayment", "Awaiting payment", "Zahlung ausstehend", "En attente de paiement", "بانتظار الدفع");
set("dashboard.statusPaid", "Paid", "Bezahlt", "Payé", "مدفوع");
set("dashboard.statusCancelled", "Cancelled", "Storniert", "Annulé", "ملغى");
set("dashboard.viewOrder", "View order", "Bestellung ansehen", "Voir la commande", "عرض الطلب");
set("dashboard.badgeWon", "Won", "Gewonnen", "Remportée", "فزت");
set("dashboard.badgeEnded", "Ended", "Beendet", "Terminée", "انتهى");
set("dashboard.badgeWinning", "Winning", "Höchstbietend", "En tête", "متصدّر");
set("dashboard.badgeOutbid", "Outbid", "Überboten", "Surenchéri", "تم تجاوزك");
set("dashboard.invoicesTitle", "Invoices", "Rechnungen", "Factures", "الفواتير");
set("dashboard.viewPdf", "View PDF", "PDF ansehen", "Voir le PDF", "عرض ملف PDF");
set("dashboard.savedSearchesTitle", "Saved searches", "Gespeicherte Suchen", "Recherches enregistrées", "عمليات البحث المحفوظة");
set("dashboard.openSearch", "Open search", "Suche öffnen", "Ouvrir la recherche", "فتح البحث");
set("dashboard.recentActivity", "Recent activity", "Letzte Aktivitäten", "Activité récente", "النشاط الأخير");
set("dashboard.noNotifications", "No notifications yet.", "Noch keine Mitteilungen.", "Aucune notification pour le moment.", "لا توجد إشعارات بعد.");

// ---------------------------------------------------------------- not found + toast
set("notFound.metaDescription",
  "We couldn't find the page you were looking for. Browse our UAE-to-EU vehicle marketplace instead.",
  "Wir konnten die gesuchte Seite nicht finden. Stöbern Sie stattdessen in unserem Fahrzeugmarktplatz VAE–EU.",
  "Nous n'avons pas trouvé la page demandée. Parcourez plutôt notre marché de véhicules ÉAU–UE.",
  "لم نتمكن من العثور على الصفحة المطلوبة. تصفّح بدلاً من ذلك سوق المركبات من الإمارات إلى أوروبا.");
set("notFound.browseCta", "Browse the marketplace", "Zum Marktplatz", "Parcourir le marché", "تصفّح السوق");
set("common.signedOut", "Signed out", "Abgemeldet", "Déconnecté", "تم تسجيل الخروج");
set("common.seeYouSoon", "See you soon.", "Bis bald.", "À bientôt.", "نراك قريبًا.");

// ---------------------------------------------------------------- landing (marketing site)
set("landing.heroTitle",
  "Premium UAE vehicles. Inspected, fairly priced, delivered to Europe.",
  "Premium-Fahrzeuge aus den VAE. Geprüft, fair bepreist, nach Europa geliefert.",
  "Véhicules premium des ÉAU. Inspectés, au juste prix, livrés en Europe.",
  "مركبات إماراتية مميزة. مفحوصة، بأسعار عادلة، وتُسلَّم إلى أوروبا.");
set("landing.heroSubtitle",
  "Inspected by our UAE field teams, listed at a fixed price for verified European trade buyers, and shipped door-to-door. The fastest way to source GCC inventory.",
  "Vor Ort von unseren Teams in den VAE geprüft, zum Festpreis für verifizierte europäische Händler angeboten und Tür-zu-Tür geliefert. Der schnellste Weg zu GCC-Bestand.",
  "Inspectés sur place par nos équipes aux ÉAU, proposés à prix fixe à des acheteurs européens vérifiés et livrés porte-à-porte. La voie la plus rapide pour sourcer des véhicules GCC.",
  "تفحصها فرقنا الميدانية في الإمارات، وتُعرض بسعر ثابت لمشترين أوروبيين موثقين، ثم تُشحن من الباب إلى الباب. أسرع طريقة لاستيراد مركبات الخليج.");
set("landing.statCycles", "Listings published", "Veröffentlichte Angebote", "Annonces publiées", "إعلانات منشورة");
set("landing.statLiveNow", "{count} live now", "{count} jetzt online", "{count} en ligne", "{count} متاحة الآن");
set("landing.feature2Title", "Fixed prices, 7-day listings", "Festpreise, 7-Tage-Angebote", "Prix fixes, annonces de 7 jours", "أسعار ثابتة وإعلانات لمدة 7 أيام");
set("landing.feature2Body",
  "Every car carries one clear price and stays listed for 7 days. Buy instantly at the listed price — no haggling, no waiting.",
  "Jedes Fahrzeug hat einen klaren Preis und bleibt 7 Tage online. Sofort zum angegebenen Preis kaufen — kein Feilschen, kein Warten.",
  "Chaque voiture a un prix clair et reste en ligne 7 jours. Achetez immédiatement au prix affiché — sans négociation, sans attente.",
  "لكل سيارة سعر واضح واحد وتبقى معروضة لمدة 7 أيام. اشترِ فورًا بالسعر المعروض — بلا مساومة وبلا انتظار.");
set("landing.feature3Body",
  "Every buyer is KYC and trade-licence verified. No tyre-kickers, no fake orders.",
  "Jeder Käufer ist KYC- und gewerblich verifiziert. Keine Reifenklopfer, keine Fake-Bestellungen.",
  "Chaque acheteur est vérifié KYC et licence professionnelle. Pas de curieux, pas de fausses commandes.",
  "كل مشتري موثّق KYC ومرخّص تجارياً. لا فضوليين ولا طلبات وهمية.");
set("landing.feature5Body",
  "Vehicle price + 2.9% platform fee + shipping. No hidden margins, no last-minute surprises.",
  "Fahrzeugpreis + 2,9 % Plattformgebühr + Versand. Keine versteckten Margen, keine Überraschungen.",
  "Prix du véhicule + 2,9 % de commission + transport. Pas de marges cachées, pas de mauvaises surprises.",
  "سعر المركبة + رسوم منصة 2.9% + الشحن. لا هوامش خفية ولا مفاجآت.");
set("landing.howStep2Title", "You buy", "Sie kaufen", "Vous achetez", "تشتري");
set("landing.howStep2Body",
  "Each car is listed at a fixed price for 7 days. Review the full inspection, then buy it instantly — no obligation until you confirm.",
  "Jedes Fahrzeug wird 7 Tage lang zum Festpreis angeboten. Prüfen Sie den vollständigen Bericht und kaufen Sie sofort — verbindlich erst mit Ihrer Bestätigung.",
  "Chaque voiture est proposée à prix fixe pendant 7 jours. Consultez l'inspection complète, puis achetez immédiatement — aucun engagement avant votre confirmation.",
  "تُعرض كل سيارة بسعر ثابت لمدة 7 أيام. راجع تقرير الفحص الكامل ثم اشترِها فورًا — دون أي التزام قبل تأكيدك.");
set("landing.howStep3Body",
  "Pay after you buy. We collect, clear customs, ship roll-on / roll-off or container, and deliver to your address.",
  "Sie zahlen nach dem Kauf. Wir holen ab, erledigen die Zollabwicklung, verschiffen RoRo oder im Container und liefern an Ihre Adresse.",
  "Vous payez après l'achat. Nous récupérons, dédouanons, expédions en RoRo ou conteneur et livrons à votre adresse.",
  "تدفع بعد الشراء. نستلم، نخلّص الجمارك، نشحن RoRo أو في حاوية، ونوصّل إلى عنوانك.");
set("landing.ctaTitle",
  "Ready to buy your first GCC car?",
  "Bereit für Ihr erstes GCC-Fahrzeug?",
  "Prêt à acheter votre première voiture GCC ?",
  "جاهز لشراء أول سيارة من الخليج؟");
set("landing.ctaBody",
  "Register a trade account in two minutes. Approved overnight, buying the next day.",
  "Händlerkonto in zwei Minuten beantragen. Über Nacht freigeschaltet.",
  "Ouvrez un compte professionnel en deux minutes. Validé du jour au lendemain.",
  "افتح حساب تجاري في دقيقتين. تتم الموافقة في اليوم التالي.");
set("landing.footerTagline",
  "UAE-to-EU online vehicle marketplace.",
  "VAE-zu-EU Online-Fahrzeugmarktplatz.",
  "Marché de véhicules en ligne ÉAU vers UE.",
  "سوق مركبات أونلاين من الإمارات إلى أوروبا.");
set("landing.footerStrap",
  "UAE → EUROPE · Inspected · Listed · Delivered",
  "VAE → EUROPA · Geprüft · Angeboten · Geliefert",
  "ÉAU → EUROPE · Inspecté · En vente · Livré",
  "الإمارات → أوروبا · مفحوصة · معروضة · مُسلَّمة");

// ---------------------------------------------------------------- pre-launch landing
set("prelaunch.subheadline",
  "Buy luxury cars from the UAE at fixed prices — fully inspected, shipped to your door in Europe.",
  "Kaufen Sie Luxusautos aus den VAE zum Festpreis — voll geprüft, bis vor Ihre Tür in Europa geliefert.",
  "Achetez des voitures de luxe des ÉAU à prix fixe — entièrement inspectées, livrées à votre porte en Europe.",
  "اشترِ سيارات فاخرة من الإمارات بأسعار ثابتة — مفحوصة بالكامل، وتُسلَّم إلى بابك في أوروبا.");
set("prelaunch.vp1Title", "Transparent fixed prices", "Transparente Festpreise", "Des prix fixes transparents", "أسعار ثابتة وشفافة");
set("prelaunch.vp1Body",
  "One clear price on verified GCC inventory. Buy instantly — no haggling, no waiting.",
  "Ein klarer Preis für geprüften GCC-Bestand. Sofort kaufen — kein Feilschen, kein Warten.",
  "Un prix clair sur un stock GCC vérifié. Achetez immédiatement — sans négociation ni attente.",
  "سعر واضح واحد لمخزون خليجي موثّق. اشترِ فورًا — بلا مساومة وبلا انتظار.");
set("prelaunch.footerAbout",
  "XportACar — premium UAE-to-EU vehicle marketplace.",
  "XportACar — Premium-Fahrzeugmarktplatz von den VAE in die EU.",
  "XportACar — marché premium de véhicules des Émirats arabes unis vers l'UE.",
  "XportACar — سوق مركبات فاخرة من الإمارات إلى الاتحاد الأوروبي.");

// ---------------------------------------------------------------- auth / KYC
set("auth.loginSubtitle",
  "Sign in to buy, watch and manage your XportACar trade account.",
  "Melden Sie sich an, um zu kaufen und Ihr Händlerkonto zu verwalten.",
  "Connectez-vous pour acheter et gérer votre compte professionnel.",
  "سجّل دخولك للشراء وإدارة حسابك.");
set("auth.kycSectionHint",
  "We verify every trade buyer. Upload your documents now — purchasing unlocks once you're approved (24–48h).",
  "Wir verifizieren jeden Händler-Käufer. Laden Sie Ihre Dokumente jetzt hoch — Käufe werden nach der Freigabe freigeschaltet (24–48 Std.).",
  "Nous vérifions chaque acheteur professionnel. Téléchargez vos documents maintenant — les achats seront débloqués après approbation (24–48 h).",
  "نتحقق من كل مشترٍ تجاري. ارفع مستنداتك الآن — يُتاح الشراء بعد الموافقة (خلال 24–48 ساعة).");
set("kyc.pendingBody",
  "Thanks — we've received your documents. Our team reviews new accounts within 24–48 hours. You'll get an email once you're approved, and then you can buy vehicles.",
  "Danke — wir haben Ihre Dokumente erhalten. Unser Team prüft neue Konten innerhalb von 24–48 Stunden. Sie erhalten eine E-Mail, sobald Sie freigegeben sind, und können dann Fahrzeuge kaufen.",
  "Merci — nous avons reçu vos documents. Notre équipe examine les nouveaux comptes sous 24 à 48 heures. Vous recevrez un e-mail dès votre approbation, et vous pourrez alors acheter des véhicules.",
  "شكرًا — استلمنا مستنداتك. يراجع فريقنا الحسابات الجديدة خلال 24–48 ساعة. ستصلك رسالة بريد إلكتروني بمجرد الموافقة، وعندها يمكنك شراء المركبات.");
set("kyc.verifiedBody",
  "Your account is verified — you can buy vehicles.",
  "Ihr Konto ist verifiziert — Sie können Fahrzeuge kaufen.",
  "Votre compte est vérifié — vous pouvez acheter des véhicules.",
  "تم التحقق من حسابك — يمكنك شراء المركبات.");
set("kyc.bannerPending",
  "Your account is pending verification — you can browse, but purchasing unlocks once you're approved.",
  "Ihr Konto wird geprüft — Sie können stöbern, aber Käufe werden nach der Freigabe freigeschaltet.",
  "Votre compte est en cours de vérification — vous pouvez naviguer, mais les achats seront débloqués après approbation.",
  "حسابك قيد التحقق — يمكنك التصفّح، لكن الشراء سيُتاح بعد الموافقة.");
set("kyc.bannerRejected",
  "Your verification was declined. Re-submit your documents to start buying.",
  "Ihre Verifizierung wurde abgelehnt. Reichen Sie Ihre Dokumente erneut ein, um zu kaufen.",
  "Votre vérification a été refusée. Soumettez à nouveau vos documents pour acheter.",
  "تم رفض التحقق الخاص بك. أعد إرسال مستنداتك لبدء الشراء.");
set("kyc.bidLockedPendingBody",
  "You can buy vehicles once your account is verified.",
  "Sie können Fahrzeuge kaufen, sobald Ihr Konto verifiziert ist.",
  "Vous pourrez acheter des véhicules une fois votre compte vérifié.",
  "يمكنك شراء المركبات بمجرد التحقق من حسابك.");
set("kyc.bidLockedRejectedBody",
  "Your verification was declined. Re-submit your documents to buy.",
  "Ihre Verifizierung wurde abgelehnt. Reichen Sie Ihre Dokumente erneut ein, um zu kaufen.",
  "Votre vérification a été refusée. Soumettez à nouveau vos documents pour acheter.",
  "تم رفض التحقق الخاص بك. أعد إرسال مستنداتك للشراء.");

// ---------------------------------------------------------------- support FAQ
set("support.subtitle",
  "Help with purchases, payments, shipping and your account.",
  "Hilfe zu Käufen, Zahlungen, Versand und Ihrem Konto.",
  "Aide pour les achats, les paiements, la livraison et votre compte.",
  "مساعدة بشأن المشتريات والمدفوعات والشحن وحسابك.");
set("support.q1q", "How does buying work?", "Wie funktioniert der Kauf?", "Comment fonctionne l'achat ?", "كيف يتم الشراء؟");
set("support.q1a",
  "UAE field teams inspect privately owned vehicles and list them at a fixed price for 7 days. Verified European buyers can buy any live listing instantly; the first confirmed purchase secures the vehicle.",
  "Teams in den VAE prüfen privat gehaltene Fahrzeuge und bieten sie 7 Tage lang zum Festpreis an. Verifizierte europäische Käufer können jedes aktive Angebot sofort kaufen; der erste bestätigte Kauf sichert das Fahrzeug.",
  "Des équipes aux Émirats inspectent des véhicules de particuliers et les proposent à prix fixe pendant 7 jours. Les acheteurs européens vérifiés peuvent acheter immédiatement toute annonce en ligne ; le premier achat confirmé réserve le véhicule.",
  "تفحص فرقنا في الإمارات المركبات المملوكة للأفراد وتعرضها بسعر ثابت لمدة 7 أيام. يمكن للمشترين الأوروبيين الموثّقين شراء أي إعلان متاح فورًا، وأول عملية شراء مؤكدة تحجز المركبة.");
set("support.q2q", "Is a purchase binding?", "Ist ein Kauf verbindlich?", "Un achat est-il ferme ?", "هل الشراء مُلزِم؟");
set("support.q2a",
  "Yes. When you confirm a purchase it is binding and the listing closes immediately. Your invoice adds the 2.9% platform fee and the shipping option you choose.",
  "Ja. Mit Ihrer Bestätigung ist der Kauf verbindlich und das Angebot wird sofort geschlossen. Ihre Rechnung enthält zusätzlich die Plattformgebühr von 2,9 % und die gewählte Versandoption.",
  "Oui. Dès que vous confirmez, l'achat est ferme et l'annonce est immédiatement close. Votre facture ajoute la commission de plateforme de 2,9 % et l'option de livraison choisie.",
  "نعم. بمجرد تأكيدك يصبح الشراء مُلزِمًا ويُغلق الإعلان فورًا. تُضاف إلى فاتورتك رسوم المنصة بنسبة 2.9% وخيار الشحن الذي تختاره.");
set("support.q3a",
  "After your purchase you have 36 hours to confirm payment and upload proof of transfer. Once confirmed, you have 5 working days to complete the wire transfer. Late or missing payment may incur charges.",
  "Nach dem Kauf haben Sie 36 Stunden, um die Zahlung zu bestätigen und einen Überweisungsnachweis hochzuladen. Nach der Bestätigung haben Sie 5 Werktage, um die Überweisung abzuschließen. Verspätete oder ausbleibende Zahlungen können Gebühren verursachen.",
  "Après votre achat, vous disposez de 36 heures pour confirmer le paiement et téléverser une preuve de virement. Une fois confirmé, vous avez 5 jours ouvrés pour effectuer le virement. Un paiement tardif ou manquant peut entraîner des frais.",
  "بعد الشراء لديك 36 ساعة لتأكيد الدفع ورفع إثبات التحويل. بعد التأكيد لديك 5 أيام عمل لإتمام التحويل البنكي. قد يؤدي التأخر في الدفع أو عدمه إلى رسوم.");
patch("support.q6a", {
  en: [["before you can bid.", "before you can buy."]],
  de: [["bevor Sie bieten können.", "bevor Sie kaufen können."]],
  fr: [["avant que vous puissiez enchérir.", "avant que vous puissiez acheter."]],
  ar: [["قبل أن تتمكن من المزايدة،", "قبل أن تتمكن من الشراء،"]],
});

set("deleteAccount.loseBids",
  "Your watchlist and saved searches",
  "Ihre Merkliste und gespeicherten Suchen",
  "Votre liste de suivi et vos recherches enregistrées",
  "قائمة متابعتك وعمليات البحث المحفوظة");

// ---------------------------------------------------------------- legal (English governs)
for (const doc of ["terms", "privacy"]) {
  set(`${doc}.lastUpdatedValue`, "7 October 2026", "7. Oktober 2026", "7 octobre 2026", "7 أكتوبر 2026");
  set(`${doc}.effectiveValue`, "7 October 2026", "7. Oktober 2026", "7 octobre 2026", "7 أكتوبر 2026");
}
patch("terms.s2Body", {
  en: [["Before bidding, you must", "Before buying, you must"]],
  de: [["Vor der Abgabe von Geboten müssen Sie", "Vor einem Kauf müssen Sie"]],
  fr: [["Avant de pouvoir enchérir, vous devez", "Avant de pouvoir acheter, vous devez"]],
  ar: [["قبل المزايدة يلزم", "قبل الشراء يلزم"]],
});
set("terms.s4Title", "Listings and purchases", "Angebote und Kauf", "Annonces et achats", "الإعلانات وعمليات الشراء");
set("terms.s4Body",
  "Each vehicle is listed at the fixed price shown on its listing. A listing stays live for 7 calendar days from publication unless the vehicle is sold first; an unsold listing then expires and may be re-listed. Confirming a purchase is a binding offer to buy at the listed price, subject to successful KYC verification. The first confirmed purchase secures the vehicle and closes the listing immediately; any later attempt to buy the same vehicle is rejected.",
  "Jedes Fahrzeug wird zu dem im Angebot genannten Festpreis angeboten. Ein Angebot ist ab Veröffentlichung 7 Kalendertage aktiv, sofern das Fahrzeug nicht vorher verkauft wird; ein nicht verkauftes Angebot läuft danach ab und kann erneut eingestellt werden. Mit der Bestätigung eines Kaufs geben Sie ein verbindliches Angebot zum Kauf zum angegebenen Preis ab, vorbehaltlich einer erfolgreichen KYC-Verifizierung. Der erste bestätigte Kauf sichert das Fahrzeug und schließt das Angebot sofort; spätere Kaufversuche für dasselbe Fahrzeug werden abgelehnt.",
  "Chaque véhicule est proposé au prix fixe indiqué sur son annonce. Une annonce reste en ligne 7 jours calendaires à compter de sa publication, sauf si le véhicule est vendu avant ; une annonce non vendue expire ensuite et peut être remise en vente. La confirmation d'un achat vaut offre ferme d'achat au prix indiqué, sous réserve d'une vérification KYC réussie. Le premier achat confirmé réserve le véhicule et clôt immédiatement l'annonce ; toute tentative ultérieure d'achat du même véhicule est refusée.",
  "تُعرض كل مركبة بالسعر الثابت المذكور في إعلانها. يبقى الإعلان متاحًا لمدة 7 أيام تقويمية من تاريخ نشره ما لم تُبَع المركبة قبل ذلك؛ وبعدها ينتهي الإعلان غير المُباع ويجوز إعادة عرضه. يُعدّ تأكيد الشراء عرضًا مُلزِمًا للشراء بالسعر المعروض، بشرط اجتياز التحقق من الهوية (KYC). أول عملية شراء مؤكدة تحجز المركبة وتُغلق الإعلان فورًا، ويُرفض أي طلب لاحق لشراء المركبة نفسها.");
patch("terms.s5Body", {
  en: [["After you win:", "After you buy:"], ["on the hammer price.", "on the vehicle price."]],
  de: [["Nach dem Zuschlag:", "Nach dem Kauf:"], ["auf den Zuschlagspreis.", "auf den Fahrzeugpreis."]],
  fr: [["Après avoir remporté l'enchère :", "Après votre achat :"], ["sur le prix d'adjudication.", "sur le prix du véhicule."]],
  ar: [["بعد الفوز:", "بعد الشراء:"], ["على سعر المطرقة.", "على سعر المركبة."]],
});
patch("terms.s14Body", {
  en: [["- place fraudulent or non-binding bids ('shill bidding');\n- bid on your own listings or coordinate bidding with others;",
        "- make fraudulent or non-binding purchases;\n- buy your own listings or coordinate with others to manipulate prices;"]],
  de: [["- keine betrügerischen oder nicht bindenden Gebote abzugeben („Shill-Bidding\");\n- nicht auf eigene Inserate zu bieten oder Gebote zu koordinieren;",
        "- keine betrügerischen oder nicht bindenden Käufe zu tätigen;\n- keine eigenen Angebote zu kaufen und sich nicht mit anderen zur Preismanipulation abzusprechen;"]],
  fr: [["- placer d'enchères frauduleuses ou non engageantes (« shill bidding ») ;\n- enchérir sur vos propres annonces ou vous coordonner avec d'autres ;",
        "- effectuer d'achats frauduleux ou non engageants ;\n- acheter vos propres annonces ou vous coordonner avec d'autres pour manipuler les prix ;"]],
  ar: [["- تقديم عروض احتيالية أو غير مُلزِمة («shill bidding»)؛\n- المزايدة على قوائمك أو التنسيق مع غيرك؛",
        "- إجراء عمليات شراء احتيالية أو غير مُلزِمة؛\n- شراء إعلاناتك الخاصة أو التنسيق مع غيرك للتلاعب بالأسعار؛"]],
});
patch("privacy.s2Body", {
  en: [["complete KYC, place bids, win and pay for vehicles,", "complete KYC, buy and pay for vehicles,"], ["- Transaction: bids, watchlist entries,", "- Transaction: purchases, watchlist entries,"]],
  de: [["die KYC-Verifizierung durchführen, Gebote abgeben, Fahrzeuge ersteigern und bezahlen", "die KYC-Verifizierung durchführen, Fahrzeuge kaufen und bezahlen"], ["- Transaktionsdaten: Gebote, Beobachtungsliste,", "- Transaktionsdaten: Käufe, Beobachtungsliste,"]],
  fr: [["complétez la vérification KYC, placez des enchères, remportez et payez des véhicules,", "complétez la vérification KYC, achetez et payez des véhicules,"], ["- Transactions : enchères, liste de suivi,", "- Transactions : achats, liste de suivi,"]],
  ar: [["أو تقديم العروض، أو الفوز بمركبة والدفع،", "أو شراء المركبات والدفع،"], ["- بيانات المعاملات: العروض، قائمة المتابعة،", "- بيانات المعاملات: المشتريات، قائمة المتابعة،"]],
});
patch("privacy.s3Body", {
  en: [["process bids and payment proofs", "process purchases and payment proofs"]],
  de: [["Gebote und Zahlungsnachweise zu bearbeiten", "Käufe und Zahlungsnachweise zu bearbeiten"]],
  fr: [["traiter les enchères et les preuves de paiement", "traiter les achats et les preuves de paiement"]],
  ar: [["ومعالجة العروض وإثباتات الدفع", "ومعالجة المشتريات وإثباتات الدفع"]],
});
patch("privacy.s4Body", {
  en: [["run the auction,", "process your purchase,"]],
  de: [["Durchführung der Auktion,", "Abwicklung Ihres Kaufs,"]],
  fr: [["gérer l'enchère,", "traiter votre achat,"]],
  ar: [["وإدارة المزاد", "ومعالجة عملية الشراء"]],
});

for (const l of LANGS) {
  fs.writeFileSync(path.join(DIR, `${l}.json`), JSON.stringify(dicts[l], null, 2) + "\n");
}
console.log("ok");
