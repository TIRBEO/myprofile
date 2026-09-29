"use client";

/* ═══════════════════════════════════════════════════════════════════
   The words Tirbeo speaks

   The interface is made of a few dozen phrases repeated everywhere: the
   names of the pages, the headings above them, and the handful of controls
   that appear on every screen. Those are written by hand here, keyed by the
   English the code already says, so a page asks for its own words rather
   than threading a dictionary through every component — and so the words
   that carry the most weight arrive with the first paint instead of
   replacing it a moment later.

   Everything else — the body copy on a hundred screens and forty-odd
   documentation articles — is filled in by lib/machine-translate, which
   translates what's actually on screen and caches the answers on the
   device. Hand-writing those would take a writer per language; this way
   the whole site follows the one choice.
   ═══════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { readLanguageId, subscribeLanguage } from "@/lib/language";

/** Every language in the picker, in the order the Language page lists them,
    minus English — English is the source the keys are written in. */
const ORDER = [
  "es",
  "pt-br",
  "fr",
  "de",
  "it",
  "nl",
  "tr",
  "ar",
  "hi",
  "id",
  "ru",
  "vi",
  "ja",
  "ko",
  "zh",
];

/** English phrase → one translation per language in ORDER. A row that is the
    wrong length would silently shift every language after the gap, so the
    build below checks rather than trusts. */
const PHRASES: Record<string, string[]> = {
  /* The rail, the index and every page heading */
  "How you use Tirbeo": ["Cómo usas Tirbeo", "Como você usa o Tirbeo", "Comment vous utilisez Tirbeo", "So nutzt du Tirbeo", "Come usi Tirbeo", "Zo gebruik je Tirbeo", "Tirbeo'yu nasıl kullanıyorsun", "كيف تستخدم Tirbeo", "आप Tirbeo का इस्तेमाल कैसे करते हैं", "Cara Anda menggunakan Tirbeo", "Как вы используете Tirbeo", "Bạn dùng Tirbeo như thế nào", "Tirbeo の使い方", "Tirbeo 사용 방법", "你如何使用 Tirbeo"],
  Security: ["Seguridad", "Segurança", "Sécurité", "Sicherheit", "Sicurezza", "Beveiliging", "Güvenlik", "الأمان", "सुरक्षा", "Keamanan", "Безопасность", "Bảo mật", "セキュリティ", "보안", "安全"],
  "Privacy and safety": ["Privacidad y seguridad", "Privacidade e segurança", "Confidentialité et sécurité", "Privatsphäre und Sicherheit", "Privacy e sicurezza", "Privacy en veiligheid", "Gizlilik ve güvenlik", "الخصوصية والسلامة", "प्राइवेसी और सुरक्षा", "Privasi dan keamanan", "Приватность и защита", "Quyền riêng tư và an toàn", "プライバシーと安全", "개인정보 및 안전", "隐私与安全"],
  "Your data": ["Tus datos", "Seus dados", "Vos données", "Deine Daten", "I tuoi dati", "Je gegevens", "Verilerin", "بياناتك", "आपका डेटा", "Data Anda", "Ваши данные", "Dữ liệu của bạn", "あなたのデータ", "내 데이터", "你的数据"],
  General: ["General", "Geral", "Général", "Allgemein", "Generale", "Algemeen", "Genel", "عام", "सामान्य", "Umum", "Основное", "Chung", "一般", "일반", "常规"],
  "Edit profile": ["Editar perfil", "Editar perfil", "Modifier le profil", "Profil bearbeiten", "Modifica profilo", "Profiel bewerken", "Profili düzenle", "تعديل الملف الشخصي", "प्रोफ़ाइल संपादित करें", "Edit profil", "Редактировать профиль", "Chỉnh sửa hồ sơ", "プロフィールを編集", "프로필 편집", "编辑资料"],
  "Personal details": ["Datos personales", "Dados pessoais", "Informations personnelles", "Persönliche Daten", "Dati personali", "Persoonlijke gegevens", "Kişisel bilgiler", "المعلومات الشخصية", "व्यक्तिगत विवरण", "Detail pribadi", "Личные данные", "Thông tin cá nhân", "個人情報", "개인 정보", "个人信息"],
  "Email preferences": ["Preferencias de correo", "Preferências de e-mail", "Préférences d'e-mail", "E-Mail-Einstellungen", "Preferenze email", "E-mailvoorkeuren", "E-posta tercihleri", "تفضيلات البريد الإلكتروني", "ईमेल प्राथमिकताएँ", "Preferensi email", "Настройки почты", "Tùy chọn email", "メールの設定", "이메일 설정", "邮件偏好设置"],
  Appearance: ["Apariencia", "Aparência", "Apparence", "Darstellung", "Aspetto", "Weergave", "Görünüm", "المظهر", "रूप", "Tampilan", "Оформление", "Giao diện", "表示", "화면", "外观"],
  "Password and security": ["Contraseña y seguridad", "Senha e segurança", "Mot de passe et sécurité", "Passwort und Sicherheit", "Password e sicurezza", "Wachtwoord en beveiliging", "Şifre ve güvenlik", "كلمة المرور والأمان", "पासवर्ड और सुरक्षा", "Kata sandi dan keamanan", "Пароль и безопасность", "Mật khẩu và bảo mật", "パスワードとセキュリティ", "비밀번호 및 보안", "密码与安全"],
  "Two-factor authentication": ["Autenticación en dos pasos", "Verificação em duas etapas", "Authentification à deux facteurs", "Zwei-Faktor-Authentifizierung", "Autenticazione a due fattori", "Tweestapsverificatie", "İki adımlı doğrulama", "المصادقة الثنائية", "टू-फैक्टर प्रमाणीकरण", "Autentikasi dua faktor", "Двухфакторная аутентификация", "Xác thực hai yếu tố", "2段階認証", "2단계 인증", "双重验证"],
  Passkeys: ["Claves de acceso", "Chaves de acesso", "Clés d'accès", "Passkeys", "Passkey", "Toegangssleutels", "Passkey'ler", "مفاتيح المرور", "पासकीज़", "Kunci sandi", "Ключи доступа", "Passkey", "パスキー", "패스키", "通行密钥"],
  "Login activity": ["Actividad de inicio de sesión", "Atividade de login", "Activité de connexion", "Anmeldeaktivität", "Attività di accesso", "Activiteit inloggen", "Giriş etkinliği", "نشاط تسجيل الدخول", "लॉगिन गतिविधि", "Aktivitas login", "Активность входов", "Hoạt động đăng nhập", "ログイン履歴", "로그인 활동", "登录活动"],
  "Devices and sessions": ["Dispositivos y sesiones", "Dispositivos e sessões", "Appareils et sessions", "Geräte und Sitzungen", "Dispositivi e sessioni", "Apparaten en sessies", "Cihazlar ve oturumlar", "الأجهزة والجلسات", "डिवाइस और सेशन", "Perangkat dan sesi", "Устройства и сессии", "Thiết bị và phiên", "デバイスとセッション", "디바이스 및 세션", "设备和会话"],
  "Account status": ["Estado de la cuenta", "Status da conta", "État du compte", "Kontostatus", "Stato dell'account", "Accountstatus", "Hesap durumu", "حالة الحساب", "खाता स्थिति", "Status akun", "Состояние аккаунта", "Trạng thái tài khoản", "アカウントの状態", "계정 상태", "账户状态"],
  "Data and permissions": ["Datos y permisos", "Dados e permissões", "Données et autorisations", "Daten und Berechtigungen", "Dati e autorizzazioni", "Gegevens en machtigingen", "Veriler ve izinler", "البيانات والأذونات", "डेटा और अनुमतियाँ", "Data dan izin", "Данные и разрешения", "Dữ liệu và quyền", "データと権限", "데이터 및 권한", "数据与权限"],
  "Activity log": ["Registro de actividad", "Registro de atividades", "Journal d'activité", "Aktivitätenprotokoll", "Registro attività", "Activiteitenlogboek", "Etkinlik günlüğü", "سجل النشاط", "गतिविधि लॉग", "Log aktivitas", "Журнал активности", "Nhật ký hoạt động", "アクティビティログ", "활동 기록", "活动记录"],
  "Your activity": ["Tu actividad", "Sua atividade", "Votre activité", "Deine Aktivität", "La tua attività", "Je activiteit", "Etkinliklerin", "نشاطك", "आपकी गतिविधि", "Aktivitas Anda", "Ваша активность", "Hoạt động của bạn", "あなたのアクティビティ", "내 활동", "你的活动"],
  "Download your data": ["Descargar tus datos", "Baixar seus dados", "Télécharger vos données", "Deine Daten herunterladen", "Scarica i tuoi dati", "Je gegevens downloaden", "Verilerini indir", "تنزيل بياناتك", "अपना डेटा डाउनलोड करें", "Unduh data Anda", "Скачать ваши данные", "Tải xuống dữ liệu của bạn", "データをダウンロード", "내 데이터 다운로드", "下载你的数据"],
  "Connected apps": ["Aplicaciones conectadas", "Apps conectados", "Applications connectées", "Verbundene Apps", "App connesse", "Verbonden apps", "Bağlı uygulamalar", "التطبيقات المتصلة", "कनेक्ट ऐप्स", "Aplikasi terhubung", "Подключённые приложения", "Ứng dụng đã kết nối", "連携アプリ", "연결된 앱", "已关联的应用"],
  "Delete account": ["Eliminar cuenta", "Excluir conta", "Supprimer le compte", "Konto löschen", "Elimina account", "Account verwijderen", "Hesabı sil", "حذف الحساب", "खाता हटाएँ", "Hapus akun", "Удалить аккаунт", "Xóa tài khoản", "アカウントを削除", "계정 삭제", "删除账户"],
  Language: ["Idioma", "Idioma", "Langue", "Sprache", "Lingua", "Taal", "Dil", "اللغة", "भाषा", "Bahasa", "Язык", "Ngôn ngữ", "言語", "언어", "语言"],
  "Help and documentation": ["Ayuda y documentación", "Ajuda e documentação", "Aide et documentation", "Hilfe und Dokumentation", "Assistenza e documentazione", "Help en documentatie", "Yardım ve belgeler", "المساعدة والوثائق", "सहायता और दस्तावेज़", "Bantuan dan dokumentasi", "Помощь и документация", "Trợ giúp và tài liệu", "ヘルプとドキュメント", "고객센터 및 문서", "帮助与文档"],

  /* The shell */
  Settings: ["Ajustes", "Configurações", "Paramètres", "Einstellungen", "Impostazioni", "Instellingen", "Ayarlar", "الإعدادات", "सेटिंग्स", "Pengaturan", "Настройки", "Cài đặt", "設定", "설정", "设置"],
  "Search settings": ["Buscar ajustes", "Pesquisar configurações", "Rechercher dans Paramètres", "Einstellungen durchsuchen", "Cerca nelle impostazioni", "Instellingen zoeken", "Ayarları ara", "البحث في الإعدادات", "सेटिंग्स खोजें", "Cari pengaturan", "Поиск по настройкам", "Tìm trong Cài đặt", "設定を検索", "설정 검색", "搜索设置"],
  Search: ["Buscar", "Pesquisar", "Rechercher", "Suchen", "Cerca", "Zoeken", "Ara", "بحث", "खोजें", "Cari", "Поиск", "Tìm", "検索", "검색", "搜索"],
  "Log out": ["Cerrar sesión", "Sair", "Se déconnecter", "Abmelden", "Esci", "Uitloggen", "Çıkış yap", "تسجيل الخروج", "लॉग आउट करें", "Keluar", "Выйти", "Đăng xuất", "ログアウト", "로그아웃", "退出登录"],

  /* The documentation */
  Documentation: ["Documentación", "Documentação", "Documentation", "Dokumentation", "Documentazione", "Documentatie", "Belgeler", "الوثائق", "दस्तावेज़", "Dokumentasi", "Документация", "Tài liệu", "ドキュメント", "문서", "文档"],
  "Usually asked": ["Preguntas frecuentes", "Perguntas frequentes", "Questions fréquentes", "Häufige Fragen", "Domande frequenti", "Veelgestelde vragen", "Sık sorulanlar", "الأسئلة الشائعة", "आम सवाल", "Sering ditanyakan", "Частые вопросы", "Câu hỏi thường gặp", "よくある質問", "자주 묻는 질문", "常见问题"],
  Related: ["Relacionado", "Relacionados", "Articles liés", "Verwandte Themen", "Correlati", "Gerelateerd", "İlgili", "ذات صلة", "संबंधित", "Terkait", "Похожие", "Có liên quan", "関連", "관련 문서", "相关"],
  "Where this is done": ["Dónde se hace", "Onde isso é feito", "Où cela se fait", "Wo das gemacht wird", "Dove si fa", "Waar je dit doet", "Nerede yapılır", "أين يتم ذلك", "यह कहाँ होता है", "Tempat melakukannya", "Где это делается", "Thực hiện ở đâu", "作業場所", "작업 위치", "操作位置"],
  Listen: ["Escuchar", "Ouvir", "Écouter", "Anhören", "Ascolta", "Luisteren", "Dinle", "استماع", "सुनें", "Dengarkan", "Слушать", "Nghe", "再生", "듣기", "收听"],
  Pause: ["Pausar", "Pausar", "Mettre en pause", "Pause", "Pausa", "Pauze", "Duraklat", "إيقاف مؤقت", "रोकें", "Jeda", "Пауза", "Tạm dừng", "一時停止", "일시정지", "暂停"],
  Continue: ["Continuar", "Continuar", "Continuer", "Fortfahren", "Continua", "Doorgaan", "Devam et", "متابعة", "जारी रखें", "Lanjutkan", "Продолжить", "Tiếp tục", "続行", "계속", "继续"],
  Stop: ["Detener", "Parar", "Arrêter", "Stopp", "Ferma", "Stoppen", "Durdur", "إيقاف", "बंद करें", "Hentikan", "Стоп", "Dừng", "停止", "정지", "停止"],
  "Back a part": ["Un fragmento atrás", "Um trecho antes", "Un morceau en arrière", "Ein Stück zurück", "Un blocco indietro", "Een stuk terug", "Bir bölüm geri", "جزء للخلف", "एक हिस्सा पीछे", "Satu bagian mundur", "На часть назад", "Lùi một đoạn", "一区切り戻る", "한 부분 뒤로", "后退一节"],
  "Hide pictures": ["Ocultar imágenes", "Ocultar imagens", "Masquer les images", "Bilder ausblenden", "Nascondi immagini", "Afbeeldingen verbergen", "Görselleri gizle", "إخفاء الصور", "चित्र छिपाएँ", "Sembunyikan gambar", "Скрыть картинки", "Ẩn hình ảnh", "画像を隠す", "그림 숨기기", "隐藏图片"],
  "Show pictures": ["Mostrar imágenes", "Mostrar imagens", "Afficher les images", "Bilder anzeigen", "Mostra immagini", "Afbeeldingen tonen", "Görselleri göster", "إظهار الصور", "चित्र दिखाएँ", "Tampilkan gambar", "Показать картинки", "Hiện hình ảnh", "画像を表示", "그림 표시", "显示图片"],
  "Was this helpful?": ["¿Te ha resultado útil?", "Isso foi útil?", "Cela a-t-il été utile ?", "War das hilfreich?", "È stato utile?", "Was dit behulpzaam?", "Bu yardımcı oldu mu?", "هل كان هذا مفيدًا؟", "क्या यह मददगार था?", "Apakah ini membantu?", "Это было полезно?", "Thông tin này có hữu ích?", "参考になりましたか？", "도움이 되었나요?", "这有帮助吗？"],
  Yes: ["Sí", "Sim", "Oui", "Ja", "Sì", "Ja", "Evet", "نعم", "हाँ", "Ya", "Да", "Có", "はい", "예", "是"],
  No: ["No", "Não", "Non", "Nein", "No", "Nee", "Hayır", "لا", "नहीं", "Tidak", "Нет", "Không", "いいえ", "아니요", "否"],
  "Write to support": ["Escribir a soporte", "Falar com o suporte", "Écrire à l'assistance", "Support schreiben", "Scrivi all'assistenza", "Schrijf naar support", "Destekle yazış", "مراسلة الدعم", "सहायता को लिखें", "Hubungi dukungan", "Написать в поддержку", "Viết cho bộ phận hỗ trợ", "サポートに連絡", "고객지원에게 문의", "联系支持"],
  "Back to documentation": ["Volver a la documentación", "Voltar à documentação", "Retour à la documentation", "Zurück zur Dokumentation", "Torna alla documentazione", "Terug naar documentatie", "Belgelere dön", "العودة إلى الوثائق", "दस्तावेज़ पर लौटें", "Kembali ke dokumentasi", "К документации", "Về tài liệu", "ドキュメントに戻る", "문서로 돌아가기", "返回文档"],
  "Read about this page": ["Leer sobre esta página", "Leia sobre esta página", "Lire à propos de cette page", "Über diese Seite lesen", "Leggi di questa pagina", "Lees over deze pagina", "Bu sayfayı oku", "اقرأ عن هذه الصفحة", "इस पेज के बारे में पढ़ें", "Baca tentang halaman ini", "Статьи об этой странице", "Đọc về trang này", "このページの説明を読む", "이 페이지 설명 읽기", "阅读本页说明"],
  "How it works": ["Cómo funciona", "Como funciona", "Comment ça marche", "So funktioniert's", "Come funziona", "Zo werkt het", "Nasıl çalışır", "كيف يعمل", "यह कैसे काम करता है", "Cara kerjanya", "Как это работает", "Cách hoạt động", "仕組み", "작동 방식", "工作原理"],
  Change: ["Cambiar", "Alterar", "Modifier", "Ändern", "Modifica", "Wijzigen", "Değiştir", "تغيير", "बदलें", "Ubah", "Изменить", "Thay đổi", "変更", "변경", "更改"],
  "Noted — thank you.": ["Anotado, gracias.", "Anotado, obrigado.", "C'est noté, merci.", "Notiert — danke.", "Annotato, grazie.", "Genoteerd, bedankt.", "Not edildi, teşekkürler.", "تم التسجيل، شكرًا لك.", "नोट किया गया — धन्यवाद।", "Dicatat, terima kasih.", "Принято, спасибо.", "Đã ghi nhận, cảm ơn.", "記録しました。ありがとう。", "기록했습니다. 감사합니다.", "已记录，谢谢。"],
  "Noted. Sorry it didn't land.": ["Anotado. Sentimos no haber sido útil.", "Anotado. Desculpe não ter ajudado.", "C'est noté. Désolé de ne pas avoir été utile.", "Notiert. Schade, dass es nicht geholfen hat.", "Annotato. Spiacenti di non esser stati utili.", "Genoteerd. Sorry dat het niet hielp.", "Not edildi. İşe yaramadığı için üzgünüm.", "تم التسجيل. نأسف لأن ذلك لم يكن مفيدًا.", "नोट किया गया। खेद है कि यह काम नहीं आया।", "Dicatat. Maaf jika tidak membantu.", "Принято. Жаль, что это не помогло.", "Đã ghi nhận. Xin lỗi vì không hữu ích.", "記録しました。お役に立てずすみません。", "기록했습니다. 도움이 되지 못해 죄송합니다.", "已记录。很抱歉没能帮上忙。"],

  /* The palette and the empty states */
  Session: ["Sesión", "Sessão", "Session", "Sitzung", "Sessione", "Sessie", "Oturum", "الجلسة", "सेशन", "Sesi", "Сессия", "Phiên", "セッション", "세션", "会话"],
  "Jump to": ["Ir a", "Ir para", "Aller à", "Wechseln zu", "Vai a", "Ga naar", "Git", "انتقل إلى", "इस पर जाएँ", "Lompat ke", "Перейти к", "Chuyển đến", "移動", "이동", "跳至"],
  "Search all settings": ["Buscar en todos los ajustes", "Pesquisar em todas as configurações", "Rechercher dans tous les paramètres", "Alle Einstellungen durchsuchen", "Cerca in tutte le impostazioni", "Alle instellingen doorzoeken", "Tüm ayarlarda ara", "البحث في جميع الإعدادات", "सभी सेटिंग्स में खोजें", "Cari semua pengaturan", "Поиск по всем настройкам", "Tìm tất cả cài đặt", "すべての設定を検索", "모든 설정 검색", "搜索全部设置"],
  "No settings match": ["Ningún ajuste coincide", "Nenhuma configuração corresponde", "Aucun paramètre ne correspond", "Keine passenden Einstellungen", "Nessuna impostazione corrispondente", "Geen instellingen gevonden", "Eşleşen ayar yok", "لا توجد إعدادات مطابقة", "कोई सेटिंग मेल नहीं खाती", "Tidak ada pengaturan yang cocok", "Нет подходящих настроек", "Không có cài đặt phù hợp", "一致する設定はありません", "일치하는 설정 없음", "没有匹配的设置"],
};

/** language → English phrase → its translation, built once at load. */
const BY_LANG: Record<string, Record<string, string>> = (() => {
  const out: Record<string, Record<string, string>> = {};
  for (const id of ORDER) out[id] = {};
  for (const [phrase, list] of Object.entries(PHRASES)) {
    if (list.length !== ORDER.length) {
      throw new Error(`i18n: "${phrase}" has ${list.length} translations, expected ${ORDER.length}`);
    }
    ORDER.forEach((id, i) => {
      out[id][phrase] = list[i];
    });
  }
  return out;
})();

/* Search is the one place the other direction is needed: once the rail reads
   "Ajustes", typing "Ajustes" has to find the page called Settings. */
const BACKWARDS = new Map<string, string>();
for (const [id, map] of Object.entries(BY_LANG)) {
  for (const [phrase, text] of Object.entries(map)) {
    BACKWARDS.set(`${id}\u0000${text.toLowerCase()}`, phrase);
  }
}

/** The English a translated phrase stands for, or the phrase itself. */
export function englishFor(text: string): string {
  const id = readLanguageId();
  if (id === "en") return text;
  return BACKWARDS.get(`${id}\u0000${text.trim().toLowerCase()}`) ?? text;
}

/** Missing keys answer in English, which is the whole point of keying the
    catalogue by the phrase the code already says. */
export function translate(id: string, phrase: string): string {
  return BY_LANG[id]?.[phrase] ?? phrase;
}

/* The machine translator (lib/machine-translate) fills in everything these
   few dozen lines don't cover. It must not then take the Spanish or Hindi
   written here as if it were English and translate it a second time, so the
   answers are kept in a set it can check a piece of text against. */
const CURATED = new Map<string, Set<string>>();
for (const [id, map] of Object.entries(BY_LANG)) {
  CURATED.set(id, new Set(Object.values(map)));
}

/** Is this already one of the words written by hand for this language? */
export function isCurated(id: string, text: string): boolean {
  return CURATED.get(id)?.has(text.trim()) ?? false;
}

export type Translate = (phrase: string) => string;

/** The reactive half. English until the store has been read, so the first
    paint matches the server's; a change on the Language page lands here
    through the same subscription the dates use. */
export function useT(): Translate {
  const [id, setId] = useState("en");

  useEffect(() => {
    setId(readLanguageId());
    return subscribeLanguage(() => setId(readLanguageId()));
  }, []);

  return useCallback((phrase: string) => translate(id, phrase), [id]);
}
