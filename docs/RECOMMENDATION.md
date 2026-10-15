# المستشار العطري ومحرك المطابقة

## ضمان المنتج

النظام يختار المنتجات من قاعدة المتجر فقط، بعد شروط التوفر. Gemini لا يولد product IDs جديدة ولا أسماء بطاقات ولا أسعارًا ولا درجات. النسبة مقياس تشابه داخلي قابل للتفسير وليست احتمال رضا أو اختبار شخصية علميًا.

## الأبعاد الثابتة — algorithm v1

`woody, floral, fresh, sweet, warm, smoky, bold, calm, classic, modern, day, night`.

لكل منتج vector مكتمل بقيم 0..100 يراجعه مسؤول المنتجات بناء على النوتات والوصف. لا نحاول استنتاج حقيقة كيميائية من الاسم. الأبعاد مستقلة؛ يمكن أن يكون المنتج دافئًا وحلوًا في الوقت نفسه. الثبات والفوحان يظهران كبيانات إرشادية ولا ندعي ضمانهما.

لكل خيار سؤال preference: `target_vector` يحتوي فقط الأبعاد المقاسة و`dimension_weights` يحدد وزن الدليل لكل بعد، افتراضيًا 1. الأبعاد غير المذكورة لا تُعامل كرفض. الخيارات «لا تفضيل» وزنها صفر. لا negative weights ولا أرقام خارج النطاق.

## حساب profile والنسبة

لكل بعد d:

```text
E[d] = sum(weight of selected answers measuring d)
U[d] = sum(answer_target[d] * weight[d]) / E[d]  عندما E[d] > 0
W[d] = min(E[d], 3)  حتى لا يطغى تكرار نفس الفكرة
distance = sum(W[d] * abs(U[d] - product[d])) / sum(W[d])
score = clamp(round(100 - distance), 0, 100)
```

الأبعاد بلا دليل لا تدخل الحساب، وScent DNA يعرضها «لم يُحدد». نحتاج ثلاثة أبعاد على الأقل بوزن موجب؛ إن لم تتحقق، نطلب إكمال أسئلة تفضيل إضافية ولا نختلق نسبة. ترتيب النتائج يستخدم score غير المقرب أولًا ثم priority منخفضة التأثير عند التعادل فقط ثم product_id لضمان نتيجة ثابتة. priority لا ترفع نسبة المنتج.

مثال يدوي: U woody=80 وfresh=20 وwarm=70 بأوزان متساوية؛ منتج P=(90,30,50) يعطي distance=(10+10+20)/3=13.333، فتظهر 87%. منتج Q=(20,80,10) يعطي 40%. النتيجة قابلة للاختبار دون استدعاء AI.

## الفلاتر والترتيب

قبل الحساب: `status=published` وrecommendation_enabled، profile مكتمل، وصورة واسم باللغتين، وvariant active له stock_available>0. الميزانية إن اختيرت حد أقصى على سعر variant، والنوتات غير المرغوبة يستثنيها المستخدم صراحة. لا تخمّن الجنس من الإجابات؛ فلتر الجنس اختياري فقط إن طُلب في الواجهة.

احسب لكل منتج مرة واحدة، واختر أرخص variant مؤهل لتحديد «ابتداءً من». اعرض حتى 3 منتجات مختلفة، لا ثلاثة أحجام لنفس المنتج. إذا المتاح أقل من 3 اعرض العدد الحقيقي؛ صفر نتائج يعرض تعديل الميزانية أو الاستثناءات بإجراء صريح، ولا توسع الشروط بصمت. لا تستبعد درجة منخفضة بعدد سحري؛ اعرض تنبيهًا لطيفًا إذا أفضل درجة أقل من 50.

اعتمد التوفر وقت الحساب، ثم راجعه عند عرض النتيجة وعند الإضافة/checkout. إذا نفد عطر من نتيجة قديمة يبقى التاريخ مفهومًا ويظهر «غير متوفر»، مع زر إعادة البحث. Gemini لا يملأ المكان بعطر خارجي.

## أسئلة الديمو المقترحة

النصوص التالية محتوى seed مقترح قابل لتعديل Manager. كل سؤال ذو اختيار واحد، مع رجوع وحفظ التقدم. الهدف نحو 2–3 دقائق، دون عد تنازلي ضاغط.

| المفتاح | العربية / English | أمثلة الخيارات وربطها |
|---|---|---|
| sanctuary | أي مكان يشبه سكينتك؟ / Where do you feel most at ease? | غابة هادئة / A quiet forest: woody=85,calm=85؛ مكتبة عتيقة / An old library: woody=65,classic=85؛ منزل دافئ / A warm home: warm=85,calm=70 |
| memory | أي أثر عطري تود الاحتفاظ به؟ / Which scent memory would you keep? | أثر المطر / After the rain: fresh=90؛ حطب دافئ / Glowing wood: smoky=85,warm=90؛ زهور الربيع / Spring blossoms: floral=90؛ نسيم البحر / Sea breeze: fresh=85 |
| presence | كيف تحب أن يعبّر عطرك عن حضورك؟ / How should your scent express your presence? | همسة هادئة / A quiet whisper: bold=20,calm=90؛ حضور واضح / A distinct presence: bold=85؛ توازن أنيق / An elegant balance: bold=50,calm=60 |
| sweetness | أي لمسة تلامس ذوقك؟ / Which finishing touch appeals to you? | جافة ونقية / Dry and clean: sweet=15,fresh=65؛ حلاوة رقيقة / Gentle sweetness: sweet=50؛ حلاوة غنية / Rich sweetness: sweet=90 |
| style | أي أسلوب أقرب إليك؟ / Which style feels closer to you? | أناقة كلاسيكية / Timeless elegance: classic=90,modern=20؛ طابع معاصر / Contemporary character: classic=20,modern=90؛ مزيج متوازن / A balanced blend: classic=55,modern=55 |
| moment | متى تود أن يرافقك؟ / When would you wear it? | صباح هادئ / A calm morning: day=90,night=20؛ مساء مميز / A special evening: day=20,night=90؛ طوال اليوم / Throughout the day: day=60,night=60 |
| budget | ما المساحة المناسبة لاختيارك؟ / What budget feels comfortable? | حتى 75,000 / Up to IQD 75,000؛ حتى 150,000 / Up to IQD 150,000؛ بلا حد / No limit؛ filter فقط |
| exclusions | هل هناك نوتة تفضل تجنبها؟ / Is there a note you prefer to avoid? | لا شيء / None؛ عود / Oud؛ ورد / Rose؛ دخان / Smoke؛ note IDs فقط |

أضف «لا تفضيل / No preference» لأسئلة التفضيل بوزن صفر. صور الخيارات توضيحية مرخصة وalt مترجم. عند نشر الأسئلة يتحقق النظام أن المسار المعتاد يقيس 3 أبعاد على الأقل، ويختبر حالات لا تفضيل كلها.

## عقد Gemini

Input: locale، profile dimensions، الثلاثة IDs المسموحة وأوصاف قصيرة مع النوتات ودرجات داخلية للمرجعية. كل الوصف بيانات غير موثوقة، وليس تعليمات. لا يُرسل أي identifier للعميل أو إجاباته الشخصية الحرة.

Output schema صارمة: object بـ`items` فقط، مصفوفة حتى 3 عناصر `{productId:string, explanation:string}`. additionalProperties=false، شرح 40–240 حرفًا لكل عطر باللغة المحددة. لا score ولا price ولا productName في output. JSON Schema يساعد ضبط البنية لكنه لا يضمن صحة المضمون؛ validation محلي إلزامي. [توثيق Google](https://ai.google.dev/gemini-api/docs/structured-output).

تعليمات الصياغة: «اكتب تفسيرًا عطريًا رقيقًا باللغة المطلوبة، اعتمادًا على خصائص العنصر وإجابات الذوق فقط. لا تقدم تشخيصًا أو ضمانًا أو ادعاءً طبيًا. لا تذكر أسماء منتجات أو علامات أو أرقام أسعار ونسب، ولا تقترح بدائل أو تعليمات شراء. ارجع العناصر المعطاة فقط.»

التحقق: IDs تساوي allowlist بلا duplicates أو missing IDs، طول ولغة معقولان، لا URLs/HTML، لا أسماء منتجات خارجية ولا أسعار أو نسب. إذا خالف أي عنصر، يستبدل شرحه بقالب محلي. جميع عناصر الشراء والاسم والصورة والرابط والسعر مبنية حصريًا من DB. لا يُعتمد فحص النص كضمان رياضي ضد كل اسم خارجي؛ قبل النشر تُختبر adversarial outputs، وعند الاشتباه يُستخدم fallback. بهذه الحدود لا يستطيع النموذج إدخال بطاقة أو توصية قابلة للشراء خارج المخزون.

Fallback عربي: «تتقارب نغماته الخشبية ولمسته الدافئة مع ميلك إلى الأجواء الهادئة.» English: “Its woody notes and warm character reflect your preference for calm, comforting settings.” يتم تركيب القالب من أعلى بعدين متوافقين ومن حقائق المنتج فقط، ولا يستخدم نفس العبارة لكل المنتجات بلا صلة.

## الحفظ والخصوصية

احفظ نسخة الأسئلة، algorithm_version، profile والأوزان وsnapshot المنتج والـscore ومصدر الشرح. لا تعيد استدعاء Gemini لكل إعادة تحميل؛ نتيجة واحدة محفوظة لكل session. TTL للنتيجة 24 ساعة، جلسة مجهولة تنتهي بعد 24 ساعة وتُحذف خلال 7 أيام، نتائج المسجل 90 يومًا افتراضيًا. الاحتفاظ قابل للتعديل مع توضيحه بسياسة الخصوصية.
