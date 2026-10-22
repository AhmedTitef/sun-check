// Spanish versions of the coach's openers, answers and floor rules: everyday
// Inland Empire Spanish, "usted", the words people use ("recibo de luz", "lease").

export const OPENERS_ES = {
  o1: { line: '¿Quiere ver su casa desde arriba? Toma diez segundos.', why: 'La curiosidad funciona mejor que un discurso. Todos quieren ver su propio techo, y usted solo pide diez segundos, no una cita.' },
  o2: { line: '¿Cómo le fue con el recibo de Edison este verano?', why: 'En zona de Edison todos tienen una historia del recibo de verano, y la pregunta no promete nada. No pregunte de entrada cuánto pagan; a la gente no le gusta.' },
  o3: { line: '¿Su luz es de Edison o de la ciudad?', why: 'Fácil de contestar caminando, y separa las casas de Edison de las de Riverside y otras ciudades con su propia compañía de luz. Luego ofrezca enseñarles su techo.' },
  o4: { line: '¿La casa donde vive por aquí es suya? Les estoy enseñando a los vecinos cuánto sol le pega a su techo.', why: 'Confirma desde la primera frase si es dueño, y "cuánto sol le pega" es una pregunta sobre su casa, no sobre un producto.' },
  o5: { line: '¿Tiene alberca, carro eléctrico o un aire acondicionado grande? De esos recibos es de lo que más me preguntan.', why: 'Las casas que gastan más son las que más sentido tienen. Nombrar el aparato lo hace personal.' },
  o6: { line: '¿Ya supo lo que cambió con los paneles solares este año? Casi nadie sabe.', why: 'El cambio del crédito de impuestos es noticia real y confunde a muchos. Úselo solo si lo puede explicar en una frase (vea "¿Se acabó el crédito de impuestos?").' },
  o7: { line: '¿En qué ciudad vive? Le enseño su techo en la pantalla.', why: 'Fácil de contestar caminando. La ciudad lleva a la dirección, y la tableta hace lo demás.' },
  o8: { line: '¿Le enseño rápido cuánto sol le pega a su techo?', why: 'Corta, amable y sobre su casa. Funciona bien para quien prefiere hablar en español.' },
};

export const ANSWERS_ES = {
  rent: { label: 'Rento', say: '¡No hay problema! Si conoce a alguien que sea dueño, esto le sirve a quien lo escanee.', next: 'Muchas veces es una forma amable de despedirse. Sonría, enséñele su código o déle una tarjeta, y déjelo ir. Los que rentan no van en la lista de "tal vez".' },
  spouse: { label: 'Tengo que preguntarle a mi pareja', say: 'Claro, es una decisión de los dos. Escojamos una hora que les quede, y qué bueno si su pareja puede estar.', next: 'Invite a la pareja; no lo exija. Algunos lo sienten como presión. ¿No están listos? Agréguelos como "tal vez" para que les llegue un enlace y lo vean juntos esta noche.' },
  cost: { label: '¿Cuánto cuesta?', say: 'Depende de su techo y de su recibo, así que no le voy a adivinar. Puede comprar, hacer un lease o pagar mensual, y el consultor le enseña sus números exactos. Reunirse con él no cuesta nada.', next: 'Luego pregunte cómo le han salido los recibos en verano. Confirme con su gerente que la consulta es gratis antes de decirlo.' },
  credit: { label: '¿No que se acabó el crédito de impuestos?', say: 'Para comprar, sí. El crédito para dueños se acabó para sistemas terminados después de 2025. Con un lease o un plan mensual, la compañía dueña de los paneles todavía puede usar un crédito de negocio, y el consultor le explica qué significa para usted.', next: 'No dé porcentajes ni fechas más allá de esto. El consultor tiene los términos actuales.' },
  moving: { label: 'Me voy a mudar / voy a vender', say: 'Qué bueno saberlo. ¿Para cuándo? Si es en unos años, pregúntele al consultor qué pasa con los paneles cuando vende, porque cada opción es distinta.', next: '¿Se mudan en menos de un año? Agradézcales y déjelos ir.' },
  roof: { label: 'Mi techo está viejo', say: 'Buen punto, la edad del techo importa. El consultor revisa el techo primero y le dice claramente si hay que arreglarlo antes de poner paneles.', next: '' },
  hoa: { label: 'Mi HOA no deja', say: 'La ley de California no deja que las HOA prohíban los paneles solares, aunque pueden poner reglas razonables. El consultor le explica lo que pide su HOA.', next: 'Si suena a que se quieren ir, déjelos ir.' },
  scam: { label: 'Los paneles son una estafa', say: 'Lo escucho mucho, y sí hay gente que no trabaja bien. Por eso hoy solo es ver sus números reales. No firma nada, y le puede preguntar al consultor lo que quiera.', next: 'Nunca discuta. Déle la razón en que es bueno tener cuidado.' },
  store: { label: '¿Trabaja para la tienda?', say: 'Trabajo con [company]. No trabajo para [store]; somos la compañía de paneles solares aquí en la tienda. Yo hago las citas y un consultor le enseña los números.', next: 'Diga con quién trabaja desde el principio. Lo que más molesta a la gente es que parezcamos empleados de la tienda.' },
  no: { label: 'No me interesa', say: 'No se preocupe. Aquí tiene una tarjeta por si algún día el recibo lo sorprende. Le enseña su propio techo, en su teléfono, cuando quiera.', next: 'Déle la tarjeta, sonría y déjelo ir. Sin presionar.' },
  battery: { label: '¿Y las baterías? ¿Y si se va la luz?', say: 'Los paneles solos se apagan cuando se va la luz, por seguridad. Una batería mantiene lo importante funcionando y le deja usar su propia energía de 4 a 9 de la noche, cuando la luz es más cara. El consultor le enseña las dos opciones.', next: '' },
  check: { label: '¿Revisan el crédito?', say: 'Hacer la cita no revisa nada. Algunos planes sí necesitan revisar el crédito más adelante, y el consultor le avisa antes.', next: 'Ajústelo a su capacitación. No adivine puntajes.' },
  have: { label: 'Ya tengo paneles', say: '¡Qué bien! ¿Cómo le han funcionado? Si algún día quiere una batería, el consultor también le puede ayudar con eso.', next: 'Muchas veces es una forma amable de despedirse. Agradézcale y déjelo ir.' },
  hurry: { label: 'Tengo prisa', say: 'Lo entiendo. Escanee esto y esta noche puede ver su techo en su teléfono y escoger una hora que le quede.', next: 'Enséñele su código. No lo persiga.' },
  info: { label: 'Mándeme información', say: 'Claro. Esto le enseña su propio techo, no un folleto. O si quiere le mando el enlace por mensaje.', next: '¿Quiere un mensaje? Agréguelo como "tal vez" y deje que marque la casilla de permiso.' },
  lowbill: { label: 'Mi recibo es bajo', say: '¡Qué bueno! Entonces a lo mejor no necesita paneles. ¡Que le vaya bien!', next: 'Los recibos bajos hacen citas débiles. Una despedida amable es la mejor respuesta.' },
  lease: { label: 'Los leases son mal negocio', say: 'Buena pregunta. Puede comprar, hacer un lease o pagar mensual, y el consultor se los enseña lado a lado. Usted escoge lo que le convenga, o nada.', next: '' },
  nem: { label: 'El NEM 3.0 ya mató lo solar', say: 'Cambió las cuentas. La energía que le manda a Edison ahora vale mucho menos, así que los sistemas se diseñan para usar más de su propia energía, muchas veces con una batería para las horas caras de 4 a 9. El consultor le enseña si le funciona a su casa.', next: '' },
  free: { label: '¿Es gratis?', say: 'No, los paneles no son gratis, y tenga cuidado con quien le diga que sí. Reunirse con el consultor no cuesta nada, y le enseña los costos reales para su casa.', next: 'Nunca diga "paneles gratis" ni "programa del gobierno".' },
  phone: { label: '¿Se puede por teléfono?', say: 'Sí. El consultor lo puede atender por teléfono o video, también en la tarde y los fines de semana.', next: '' },
  sell: { label: '¿Y si vendo la casa?', say: 'Tiene opciones. Normalmente se le pasa al comprador: [company] tiene un equipo que hace el papeleo, y el comprador pasa una revisión de crédito ligera. O puede pagar por adelantado lo que falta, y el comprador solo recibe la energía. El consultor le explica todo.', next: 'De las páginas de la propia compañía sobre vender la casa. Sin garantías de qué tan rápido se vende.' },
  zero: { label: '¿Mi recibo va a quedar en cero?', say: 'No. El cargo fijo mensual de Edison se queda aunque tenga paneles. El consultor le enseña cómo quedaría su recibo.', next: 'Nunca prometa un recibo en cero.' },
  north: { label: 'Mi casa da al norte', say: 'Muchas veces sí se puede. Casi todos los techos tienen más de un lado, y los paneles van en los lados con más sol. El diseño en la tableta le enseña exactamente dónde.', next: '' },
  front: { label: 'No quiero paneles al frente', say: 'No hay problema. Dígaselo al consultor y diseñan para atrás o los lados. Si esos reciben menos sol, le enseñan la diferencia.', next: 'La página también lo pregunta, y sale en la solicitud.' },
  reviews: { label: 'He oído cosas malas de ustedes', say: 'Es justo preguntar. Toda compañía grande tiene clientes descontentos. Lea las reseñas, pregúntele al consultor lo que quiera y decida usted. Hoy solo es ver sus números.', next: 'Nunca hable mal de la competencia.' },
};

export const RULES = {
  en: ['Help first, then say who you\'re with: “I\'m with [company]. I don\'t work for [store].”', 'Never at the registers or in a checkout line.', 'Take no for an answer. No following, no blocking an exit.', 'Don\'t open by asking how much their bill is.'],
  es: ['Primero ayude, luego diga con quién trabaja: “Trabajo con [company]. No trabajo para [store].”', 'Nunca en las cajas ni en la fila para pagar.', 'Acepte un no. Sin seguir a la gente, sin bloquear la salida.', 'No empiece preguntando cuánto pagan de luz.'],
};

export const PRACTICE_PROMPT_ES = (openers, answers) => `Vas a hacer el papel de un cliente con prisa en una tienda de mejoras para el hogar en el Inland Empire, en el sur de California. Yo atiendo un puesto de paneles solares dentro de la tienda y hago citas. Ayúdame a practicar hablando conmigo en voz alta, en español.

Cómo jugar:
- Sé un cliente de verdad, no un vendedor. Respuestas cortas, un poco distraído y a veces desconfiado.
- En cada ronda escoge en secreto un cliente nuevo: dueño o inquilino, de 25 a 75 años, con o sin pareja, cliente de Edison (SCE) con un recibo de verano de entre $120 y $450.
- Yo empiezo con una frase. Si es débil, sigue caminando. Si es buena, detente y platica.
- Sácame dos a cuatro de estas objeciones, una por una, cuando salgan de forma natural: ${answers.map(a => `"${a.label}"`).join(', ')}.
- No me la pongas fácil. Si prometo ahorros, digo que algo es gratis, menciono un programa del gobierno o actúo como si trabajara para la tienda, dímelo de inmediato.
- La ronda termina cuando hago una cita (tú me das día y hora), cuando consigo un "tal vez" (aceptas un mensaje) o cuando te vas.
- Después de cada ronda, sal del personaje por menos de 30 segundos: algo que hice bien, algo que debo mejorar y una frase mejor que pude haber dicho.
- Luego empieza otra ronda con un cliente distinto.

Frases de entrada que estoy probando: ${openers.map(o => `"${o.line}"`).join(' / ')}.

Empieza ya. Vas pasando frente a mi puesto con tu carrito.`;
