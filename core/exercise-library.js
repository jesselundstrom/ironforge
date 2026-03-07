// Central exercise catalog + localized movement guidance.
(function(){
'use strict';

const catalogById={};
const lookupByName={};
const localizedNameByLocale={
  fi:{
    'squat':'Takakyykky',
    'back squat':'Takakyykky',
    'barbell back squat':'Takakyykky',
    'front squat':'Etukyykky',
    'paused squat':'Pysaytyskyykky',
    'pause squat':'Pysaytyskyykky',
    'bench':'Penkkipunnerrus',
    'bench press':'Penkkipunnerrus',
    'barbell bench press':'Penkkipunnerrus',
    'incline press':'Vinopenkkipunnerrus',
    'close-grip bench':'Kapean otteen penkkipunnerrus',
    'close-grip bench press':'Kapean otteen penkkipunnerrus',
    'spoto press':'Spoto-punnerrus',
    'deadlift':'Maastaveto',
    'sumo deadlift':'Sumomaastaveto',
    'stiff leg deadlift':'Suorajalkainen maastaveto',
    'ohp':'Pystypunnerrus',
    'overhead press':'Pystypunnerrus',
    'overhead press (ohp)':'Pystypunnerrus',
    'push press':'Tyontopunnerrus',
    'barbell rows':'Kulmasoutu',
    'barbell row':'Kulmasoutu'
  }
};

function normalize(value){
  return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
}

function slugify(value){
  return normalize(value).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

function getDisplayName(input,locale){
  const current=(window.I18N&&I18N.normalizeLocale)?I18N.normalizeLocale(locale||I18N.getLanguage()):'en';
  const exercise=getExercise(input);
  const rawName=exercise?.name||String(input||'').trim();
  if(!rawName)return '';
  const translated=localizedNameByLocale[current]?.[normalize(rawName)];
  return translated||rawName;
}

function inferCategory(name){
  const n=normalize(name);
  if(/squat|leg press|lunge|step-up/.test(n))return 'squat';
  if(/deadlift|romanian|rdl|hinge|good morning|glute bridge|hamstring|hip extension/.test(n))return 'hinge';
  if(/bench|press|push-up|dip|triceps|ohp/.test(n))return 'press';
  if(/row|pull-up|pullup|chin-up|pulldown|pull-down|pull apart|dead hang/.test(n))return 'pull';
  if(/plank|ab|core|crunch|wheel|pallof|dead bug/.test(n))return 'core';
  if(/curl|raise/.test(n))return 'isolation';
  return 'general';
}

function guidanceFor(name,category){
  const localizedNameEn=getDisplayName(name,'en')||name;
  const localizedNameFi=getDisplayName(name,'fi')||name;
  if(category==='squat'){
    return{
      en:{
        description:localizedNameEn+' is a lower-body strength movement that trains quads and glutes while reinforcing bracing.',
        setup:'Set feet about shoulder-width, root your whole foot, and brace your trunk before each rep.',
        execution:[
          'Sit down and slightly back while keeping chest and hips moving together.',
          'Descend under control until depth is safe and repeatable.',
          'Drive through mid-foot to stand tall without losing trunk tension.'
        ],
        cues:['Brace before every rep.','Keep knees tracking over toes.','Push the floor away on the ascent.'],
        safety:'Stop sets when bracing or knee tracking breaks down; reduce load if depth changes your position.',
        media:{}
      },
      fi:{
        description:localizedNameFi+' on alavartalon voimaliike, joka kehittaa etu- ja pakaralihaksia seka keskivartalon tukea.',
        setup:'Aseta jalat noin hartialeveyteen, pida koko jalkapohja maassa ja tue keskivartalo ennen jokaista toistoa.',
        execution:[
          'Istuudu alas ja hieman taakse niin, etta rinta ja lantio liikkuvat yhdessa.',
          'Laske hallitusti turvalliseen ja toistettavaan syvyyteen.',
          'Ponnista keskijalan kautta ylos ja pida vartalon tuki koko nousun ajan.'
        ],
        cues:['Tue keskivartalo ennen jokaista toistoa.','Polvet seuraavat varpaita.','Ponnauta lattiaa poispain nousussa.'],
        safety:'Lopeta sarja, jos tuki pettaa tai polvilinja karkaa; kevenna painoa tarvittaessa.',
        media:{}
      }
    };
  }
  if(category==='hinge'){
    return{
      en:{
        description:localizedNameEn+' develops posterior-chain strength and teaches powerful hip extension with a stable spine.',
        setup:'Stand balanced over mid-foot, hinge from the hips, and lock in a neutral spine before you move the weight.',
        execution:[
          'Load hips back while keeping the bar or implement close to your body.',
          'Maintain tension in lats and trunk through the full range.',
          'Finish by extending hips and knees together without over-leaning back.'
        ],
        cues:['Hips back, chest long.','Keep load close to your body.','Stand tall, do not hyperextend at lockout.'],
        safety:'Avoid chasing range if lumbar position changes; keep reps controlled and technical.',
        media:{}
      },
      fi:{
        description:localizedNameFi+' kehittaa takaketjun voimaa ja opettaa tehokasta lonkan ojennusta neutraalilla selalla.',
        setup:'Seiso tasapainoisesti keskijalalla, taita lonkasta ja lukitse neutraali selka ennen nostoa.',
        execution:[
          'Vie lantiota taakse ja pida tanko tai valine lahella vartaloa.',
          'Sailyta ylaselan ja keskivartalon jannitys koko liikeradan ajan.',
          'Viimeistele ojentamalla lonkka ja polvi yhdessa ilman yliojennusta.'
        ],
        cues:['Lantio taakse, rinta pitkana.','Pida kuorma lahella vartaloa.','Nouse pystyyn, valta yliojennusta lopussa.'],
        safety:'Ala hae enempaa liikelaajuutta, jos alaselan asento muuttuu; pida tekniikka ensisijaisena.',
        media:{}
      }
    };
  }
  if(category==='press'){
    return{
      en:{
        description:localizedNameEn+' builds pressing strength through chest, shoulders, and triceps while demanding upper-body stability.',
        setup:'Set shoulder position first, grip evenly, and brace before initiating each press.',
        execution:[
          'Lower with control to a consistent touch point or bottom position.',
          'Keep forearms stacked to transfer force efficiently.',
          'Press smoothly to lockout while maintaining ribcage and shoulder control.'
        ],
        cues:['Control the descent.','Stack wrists over elbows.','Press through a stable torso.'],
        safety:'Use a load that allows stable shoulder position; stop if joint pain replaces muscular effort.',
        media:{}
      },
      fi:{
        description:localizedNameFi+' kehittaa punnerrusvoimaa rintalihaksille, olkapaille ja ojentajille seka vaatii ylavartalon hallintaa.',
        setup:'Aseta olkapaat ensin, ota tasainen ote ja tue keskivartalo ennen jokaista toistoa.',
        execution:[
          'Laske hallitusti samaan ala-asentoon jokaisella toistolla.',
          'Pida kyynarvarret linjassa, jotta voima siirtyy tehokkaasti.',
          'Punnerra tasaisesti ylos loppuasentoon ilman rintakehan hallinnan menetysta.'
        ],
        cues:['Hallitse lasku.','Ranne ja kyynarpaa samaan linjaan.','Punnerra vakaalla vartalolla.'],
        safety:'Valitse kuorma, jolla olkapaat pysyvat hallinnassa; lopeta jos kipu korvaa lihastyon.',
        media:{}
      }
    };
  }
  if(category==='pull'){
    return{
      en:{
        description:localizedNameEn+' trains upper-back pulling strength and improves shoulder mechanics through controlled scapular movement.',
        setup:'Start with ribs down, shoulder blades set, and a grip that allows full range without shrugging.',
        execution:[
          'Initiate by pulling elbows toward hips or torso.',
          'Pause briefly in the contracted position to own the top.',
          'Return under control to a full stretch without losing trunk position.'
        ],
        cues:['Lead with elbows.','Keep neck relaxed.','Control both up and down phases.'],
        safety:'If range forces shoulder shrugging or lumbar swing, reduce load and tighten control.',
        media:{}
      },
      fi:{
        description:localizedNameFi+' kehittaa ylaselan vetovoimaa ja parantaa olkapaan liikekontrollia lapaluun hallinnan kautta.',
        setup:'Aloita kyljet alhaalla, lapaluut hallinnassa ja otteella, jolla saat tayden liikeradan ilman hartioiden nousua.',
        execution:[
          'Aloita veto viemalla kyynarpaat kohti lantiota tai vartaloa.',
          'Pida yla-asennossa lyhyt pysaytys hallinnan varmistamiseksi.',
          'Palauta hallitusti venytykseen menettamatta vartalon asentoa.'
        ],
        cues:['Johda kyynarpaalla.','Pida niska rentona.','Hallitse seka veto- etta paluuvaihe.'],
        safety:'Jos liikerata vaatii hartioiden nousua tai vartalon heiluntaa, kevenna kuormaa.',
        media:{}
      }
    };
  }
  if(category==='core'){
    return{
      en:{
        description:localizedNameEn+' targets trunk control and anti-movement capacity to support heavier compound lifting.',
        setup:'Establish a neutral pelvis and rib position before each rep or hold.',
        execution:[
          'Move slowly and keep breathing controlled through the set.',
          'Prioritize trunk stiffness over range or speed.',
          'End the set before compensations appear in the low back or shoulders.'
        ],
        cues:['Exhale and brace.','Keep pelvis stacked under ribs.','Quality over reps.'],
        safety:'If you feel lower-back pinching, shorten range and reduce intensity.',
        media:{}
      },
      fi:{
        description:localizedNameFi+' kehittaa keskivartalon hallintaa ja anti-liikekapasiteettia tukemaan raskaampia perusliikkeita.',
        setup:'Loyda neutraali lantion ja rintakehan asento ennen jokaista toistoa tai pitoa.',
        execution:[
          'Liiku rauhallisesti ja hengita hallitusti koko sarjan ajan.',
          'Priorisoi keskivartalon jannitys liikelaajuuden tai nopeuden sijaan.',
          'Lopeta ennen kuin alaselka tai hartiat alkavat kompensoida.'
        ],
        cues:['Uloshengitys ja tuki.','Pida lantio rintakehan alla.','Laatu ennen maaraa.'],
        safety:'Jos alaselkaan tulee nipistysta, lyhenna liikerataa ja kevenna.',
        media:{}
      }
    };
  }
  if(category==='isolation'){
    return{
      en:{
        description:localizedNameEn+' is an accessory movement for targeted hypertrophy and joint-friendly volume.',
        setup:'Choose a stable body position and start with a controllable load.',
        execution:[
          'Use smooth reps with full control through both phases.',
          'Keep tension on the target muscle instead of using momentum.',
          'Match range to comfort while preserving joint alignment.'
        ],
        cues:['Slow eccentric.','No swinging.','Chase muscle tension, not load.'],
        safety:'Avoid compensating with torso movement; reduce weight if technique drifts.',
        media:{}
      },
      fi:{
        description:localizedNameFi+' on apuliike kohdennettuun lihaskasvuun ja nivelystavalliseen harjoitusvolyymiin.',
        setup:'Valitse vakaa asento ja kuorma, jonka hallitset koko sarjan ajan.',
        execution:[
          'Tee toistot tasaisesti ja hallitusti molempiin suuntiin.',
          'Pida jannitys kohdelihaksessa ilman vauhdin kayttoa.',
          'Sovita liikerata mukavaksi niin, etta nivelten linjaus sailyy.'
        ],
        cues:['Hidas jarrutusvaihe.','Ei heilumista.','Hae lihastuntemusta, ei maksikuormaa.'],
        safety:'Valta vartalon kompensaatiota; kevenna painoa jos tekniikka karkaa.',
        media:{}
      }
    };
  }
  return{
    en:{
      description:localizedNameEn+' is a general strength accessory used to build capacity around main lifts.',
      setup:'Use a stable start position and brace before each rep.',
      execution:[
        'Move through a controlled and repeatable range.',
        'Keep tension on the target muscles throughout the set.',
        'Finish each rep with balanced posture and control.'
      ],
      cues:['Control tempo.','Keep positions repeatable.','Stop before form degrades.'],
      safety:'Prioritize repeatable mechanics over adding load.',
      media:{}
    },
    fi:{
      description:localizedNameFi+' on yleinen voimaharjoittelun apuliike, jolla rakennetaan kapasiteettia paa liikkeiden tueksi.',
      setup:'Aloita vakaasta asennosta ja tue keskivartalo ennen jokaista toistoa.',
      execution:[
        'Liiku hallitulla ja toistettavalla liikeradalla.',
        'Pida jannitys kohdelihaksissa koko sarjan ajan.',
        'Viimeistele toisto tasapainoisessa asennossa.'
      ],
      cues:['Hallitse tempo.','Pida asennot toistettavina.','Lopeta ennen tekniikan hajoamista.'],
      safety:'Aseta toistettava tekniikka kuorman kasvattamisen edelle.',
      media:{}
    }
  };
}

function registerExercise(entry){
  if(!entry||!entry.name)return null;
  const id=entry.id||slugify(entry.name);
  const existing=catalogById[id];
  if(existing)return existing;
  const category=entry.category||inferCategory(entry.name);
  const guidance=entry.guidance||guidanceFor(entry.name,category);
  const record={
    id,
    name:entry.name,
    category,
    aliases:Array.isArray(entry.aliases)?entry.aliases.slice():[],
    guidance
  };
  catalogById[id]=record;
  lookupByName[normalize(record.name)]=id;
  record.aliases.forEach(alias=>{lookupByName[normalize(alias)]=id;});
  return record;
}

function registerAlias(alias,target){
  const id=resolveExerciseId(target);
  if(!id)return;
  lookupByName[normalize(alias)]=id;
}

function resolveExerciseId(input){
  if(!input)return null;
  if(typeof input==='object'){
    if(input.exerciseId&&catalogById[input.exerciseId])return input.exerciseId;
    if(input.name)return resolveExerciseId(input.name);
    return null;
  }
  const raw=String(input).trim();
  if(!raw)return null;
  if(catalogById[raw])return raw;
  return lookupByName[normalize(raw)]||null;
}

function getExercise(input){
  const id=resolveExerciseId(input);
  return id?catalogById[id]:null;
}

function pickLocale(entry,locale){
  const current=(window.I18N&&I18N.normalizeLocale)?I18N.normalizeLocale(locale||I18N.getLanguage()):'en';
  const en=entry.guidance.en||{};
  const local=entry.guidance[current]||{};
  return{
    locale:current,
    description:local.description||en.description||'',
    setup:local.setup||en.setup||'',
    execution:Array.isArray(local.execution)&&local.execution.length?local.execution:(en.execution||[]),
    cues:Array.isArray(local.cues)&&local.cues.length?local.cues:(en.cues||[]),
    safety:local.safety||en.safety||'',
    media:local.media||en.media||{}
  };
}

function getExerciseGuidance(input,locale){
  const exercise=getExercise(input);
  if(!exercise)return null;
  const localized=pickLocale(exercise,locale);
  return{
    id:exercise.id,
    name:getDisplayName(exercise.name,locale),
    category:exercise.category,
    description:localized.description,
    setup:localized.setup,
    execution:localized.execution,
    cues:localized.cues,
    safety:localized.safety,
    media:localized.media
  };
}

function getAllExercises(){
  return Object.values(catalogById);
}

const KNOWN_EXERCISE_NAMES=[
  'Squat','Bench Press','Deadlift','OHP','Overhead Press (OHP)','Barbell Row',
  'Front Squat','Paused Squat','Pause Squat','High Bar Squat','Beltless Squat','Wider Stance Squat','Narrower Stance Squat','Box Squat','Pin Squat','Half Squat','Good Morning','Squat With Slow Eccentric','Leg Press',
  'Close-Grip Bench','Close-Grip Bench Press','Long Pause Bench','Spoto Press','Incline Press','Wider Grip Bench','Board Press','Pin Press','Slingshot Bench','Bench With Feet Up','Bench With Slow Eccentric','DB Bench','DB Incline Press',
  'Sumo Deadlift','Conventional Deadlift','Block Pull','Rack Pull','Deficit Deadlift','Romanian Deadlift','Romanian Deadlifts (RDL)','Stiff Leg Deadlift','Snatch Grip Deadlift','Trap Bar Deadlift',
  'Push Press','Behind The Neck OHP','Seated OHP','DB OHP',
  'Barbell Rows','Dumbbell Rows','DB Rows','Chest Supported Rows','Chest-Supported Rows','T-Bar Rows','Pull-ups','Chin-ups','Neutral Grip Pull-ups','Neutral-Grip Pull-ups','Assisted Chin-ups','Pull-downs','Lat Pulldowns','Lat Pull-down (Wide Grip)','Lat Pull-down (Close Grip)','Seated Cable Rows','Machine Rows',
  'Bulgarian Split Squats','Bodyweight Squats','Barbell Back Squat','Dumbbell Goblet Squat','Machine Leg Press','Dumbbell Lunges','Walking Lunges','Step-Ups','Reverse Lunges',
  'Barbell Bench Press','Dumbbell Bench Press','Machine Chest Press','Push-ups','Dips','Close-Grip Push-ups',
  'Barbell Romanian Deadlift','Dumbbell Romanian Deadlift','Dumbbell Glute Bridges','Back Extensions','45deg Hip Extensions','Hamstring Curls',
  'Band Pull-Aparts','Dead Hangs','Weighted Planks','Pallof Press','Ab Wheel Rollouts','Ab Crunches','Cable Crunches','Hanging Leg Raises','Dead Bugs',
  'Dumbbell Bicep Curls','Dumbbell Lateral Raises','Overhead Dumbbell Press','Overhead Triceps Extensions','Skull Crushers'
];

KNOWN_EXERCISE_NAMES.forEach(name=>registerExercise({name}));

registerAlias('overhead press','OHP');
registerAlias('db row','Dumbbell Rows');
registerAlias('db rows','Dumbbell Rows');
registerAlias('pause squat','Paused Squat');
registerAlias('lat pulldown','Pull-downs');
registerAlias('lat pull-down','Pull-downs');

window.EXERCISE_LIBRARY={
  resolveExerciseId,
  getExercise,
  getDisplayName,
  getExerciseGuidance,
  getAllExercises,
  registerExercise,
  registerAlias
};
})();
