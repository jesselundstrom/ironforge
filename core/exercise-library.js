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
    'barbell row':'Kulmasoutu',
    'romanian deadlifts (rdl)':'Romanialaiset maastavedot (RDL)',
    'romanian deadlift':'Romanialainen maastaveto',
    'barbell romanian deadlift':'Romanialainen maastaveto (tanko)',
    'dumbbell romanian deadlift':'Romanialainen maastaveto (käsipainot)',
    'bulgarian split squats':'Bulgarialainen haarakyykky',
    'bulgarian split squat':'Bulgarialainen haarakyykky',
    'dumbbell rows':'Käsipainosoutu',
    'dumbbell row':'Käsipainosoutu',
    'db rows':'Käsipainosoutu',
    'db row':'Käsipainosoutu',
    'db incline press':'Vinopenkkipunnerrus (käsipainot)',
    'dumbbell bench press':'Penkkipunnerrus (käsipainot)',
    'dumbbell bench':'Penkkipunnerrus (käsipainot)',
    'machine chest press':'Rintapunnerrus (laite)',
    'chin-ups':'Leuanveto (myötäote)',
    'chin ups':'Leuanveto (myötäote)',
    'pull-ups':'Leuanveto (ylikäden ote)',
    'pull ups':'Leuanveto (ylikäden ote)',
    'neutral grip pull-ups':'Leuanveto (neutraaliote)',
    'neutral-grip pull-ups':'Leuanveto (neutraaliote)',
    'assisted chin-ups':'Avustettu leuanveto',
    'lat pulldowns':'Alasvedot',
    'lat pull-down (wide grip)':'Alasvedot (leveäote)',
    'lat pull-down (close grip)':'Alasvedot (kapea ote)',
    'lat pull-down':'Alasvedot',
    'pull-downs':'Alasvedot',
    'dips':'Dipsit',
    'weighted planks':'Painollinen lankku',
    'ab wheel rollouts':'Vatsapyörä',
    'ab wheel':'Vatsapyörä',
    'hanging leg raises':'Roikkuvat jalkojen nostot',
    'cable crunches':'Kaapelirutistus',
    'ab crunches':'Vatsarutistus',
    'dead bugs':'Dead bug',
    'pallof press':'Pallof-punnerrus',
    'band pull-aparts':'Vastusnauhaveto',
    'band pull-apart':'Vastusnauhaveto',
    'dead hangs':'Riippuminen tangolla',
    'bodyweight squats':'Kehonpainokyykky',
    'push-ups':'Punnerrukset',
    'push ups':'Punnerrukset',
    'close-grip push-ups':'Kapea punnerrus',
    'barbell back squat':'Takakyykky',
    'dumbbell goblet squat':'Goblet-kyykky',
    'machine leg press':'Jalkaprässi',
    'leg press':'Jalkaprässi',
    'dumbbell lunges':'Käsipainoaskelkyykky',
    'walking lunges':'Kävelyaskelkyykky',
    'reverse lunges':'Taakseaskellus',
    'step-ups':'Askelkyykky (koroke)',
    'step ups':'Askelkyykky (koroke)',
    'dumbbell glute bridges':'Pakarasilta käsipainolla',
    'back extensions':'Selän ojennus',
    '45° hip extensions':'45° lonkan ojennus',
    '45deg hip extensions':'45° lonkan ojennus',
    'hamstring curls':'Takareiden koukistus',
    'dumbbell bicep curls':'Käsipainohauiskääntö',
    'dumbbell lateral raises':'Käsipainosivunousu',
    'overhead dumbbell press':'Pystypunnerrus (käsipainot)',
    'overhead triceps extensions':'Tricepsojentaja pään yli',
    'skull crushers':'Skull crushers',
    'seated cable rows':'Taljasoutu istuen',
    'chest-supported rows':'Rintatuettu soutu',
    'chest supported rows':'Rintatuettu soutu',
    't-bar rows':'T-tankosoutu',
    'machine rows':'Soutulaite',
    'barbell bench press':'Penkkipunnerrus',
    'high bar squat':'High bar -kyykky',
    'beltless squat':'Vyötön kyykky',
    'wider stance squat':'Leveäasentoinen kyykky',
    'narrower stance squat':'Kapea-asentoinen kyykky',
    'box squat':'Boksikyykky',
    'pin squat':'Pin-kyykky',
    'half squat':'Puolikyykky',
    'good morning':'Good morning',
    'squat with slow eccentric':'Kyykky hitaalla laskulla',
    'long pause bench':'Penkkipunnerrus pitkällä pysäytyksellä',
    'wider grip bench':'Leveän otteen penkkipunnerrus',
    'board press':'Lautapunnerrus',
    'pin press':'Pin-punnerrus',
    'slingshot bench':'Slingshot-penkkipunnerrus',
    'bench with feet up':'Penkkipunnerrus jalat ylhäällä',
    'bench with slow eccentric':'Penkkipunnerrus hitaalla laskulla',
    'db bench':'Penkkipunnerrus (käsipainot)',
    'conventional deadlift':'Perinteinen maastaveto',
    'block pull':'Blokilta maastaveto',
    'rack pull':'Telineveto',
    'deficit deadlift':'Korokkeelta maastaveto',
    'snatch grip deadlift':'Tempausotteen maastaveto',
    'trap bar deadlift':'Trap bar -maastaveto',
    'behind the neck ohp':'Pystypunnerrus niskan takaa',
    'seated ohp':'Pystypunnerrus istuen',
    'db ohp':'Pystypunnerrus (käsipainot)'
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

function uniqueList(items){
  return [...new Set((items||[]).filter(Boolean))];
}

function arrayify(value){
  if(Array.isArray(value))return value.filter(Boolean);
  if(value===undefined||value===null||value==='')return [];
  return [value];
}

const DISPLAY_MUSCLE_GROUP_BY_MUSCLE={
  chest:'chest',
  upper_chest:'chest',
  lats:'back',
  upper_back:'back',
  lower_back:'back',
  shoulders:'shoulders',
  front_delts:'shoulders',
  side_delts:'shoulders',
  rear_delts:'shoulders',
  upper_traps:'shoulders',
  biceps:'biceps',
  triceps:'triceps',
  forearms:'forearms',
  grip:'forearms',
  quads:'quads',
  hamstrings:'hamstrings',
  glutes:'glutes',
  adductors:'glutes',
  calves:'calves',
  core:'core',
  abs:'core',
  obliques:'core'
};

function mapMuscleToDisplayGroup(muscle){
  return DISPLAY_MUSCLE_GROUP_BY_MUSCLE[normalize(muscle)]||null;
}

function getDisplayMuscleGroups(primaryMuscles,secondaryMuscles){
  return uniqueList([...(primaryMuscles||[]),...(secondaryMuscles||[])].map(mapMuscleToDisplayGroup).filter(Boolean));
}

function inferMovementTags(name,category){
  const n=normalize(name);
  const tags=[];
  if(category==='squat')tags.push('squat');
  if(category==='hinge')tags.push('hinge');
  if(category==='press'){
    if(/ohp|overhead|push press|behind the neck|seated ohp|overhead dumbbell press/.test(n))tags.push('vertical_press');
    else tags.push('horizontal_press');
  }
  if(category==='pull'){
    if(/pull-up|pull up|chin-up|chin up|pulldown|pull-down|dead hang/.test(n))tags.push('vertical_pull');
    else tags.push('horizontal_pull');
  }
  if(category==='core')tags.push('core');
  if(category==='isolation')tags.push('isolation');
  if(/lunge|split squat|step-up|step ups|reverse lunges/.test(n))tags.push('single_leg');
  if(/bench|press|dip|push-up|push up/.test(n)&&!tags.includes('horizontal_press')&&!tags.includes('vertical_press'))tags.push('press');
  if(/row|pull/.test(n)&&!tags.includes('horizontal_pull')&&!tags.includes('vertical_pull'))tags.push('pull');
  return uniqueList(tags.length?tags:[category||'general']);
}

function inferEquipmentTags(name){
  const n=normalize(name);
  const tags=[];
  if(/barbell|bench press|squat|deadlift|ohp|good morning|row|board press|pin press/.test(n))tags.push('barbell');
  if(/dumbbell|db /.test(n))tags.push('dumbbell');
  if(/machine|leg press|hamstring curls|machine rows|machine chest press/.test(n))tags.push('machine');
  if(/cable/.test(n))tags.push('cable');
  if(/band/.test(n))tags.push('band');
  if(/pull-up|pull up|chin-up|chin up|dead hangs|dead hang/.test(n))tags.push('pullup_bar');
  if(/bodyweight|push-ups|push ups|dips|plank|ab wheel|dead bugs|hanging leg raises/.test(n))tags.push('bodyweight');
  if(/trap bar/.test(n))tags.push('trap_bar');
  return uniqueList(tags.length?tags:['general']);
}

function inferMuscleGroups(name,category){
  const n=normalize(name);
  if(category==='squat'){
    if(/split squat|lunge|step-up|step ups|reverse lunges/.test(n))return{primary:['quads','glutes'],secondary:['hamstrings','core']};
    if(/leg press/.test(n))return{primary:['quads','glutes'],secondary:['hamstrings']};
    return{primary:['quads','glutes'],secondary:['hamstrings','core']};
  }
  if(category==='hinge'){
    if(/glute bridge/.test(n))return{primary:['glutes','hamstrings'],secondary:['core']};
    if(/hamstring curl/.test(n))return{primary:['hamstrings'],secondary:['calves']};
    if(/back extension|hip extension/.test(n))return{primary:['glutes','hamstrings','lower_back'],secondary:['core']};
    return{primary:['hamstrings','glutes','lower_back'],secondary:['upper_back','core']};
  }
  if(category==='press'){
    if(/incline/.test(n))return{primary:['chest','front_delts','triceps'],secondary:['upper_chest']};
    if(/ohp|overhead|push press|behind the neck|seated ohp|overhead dumbbell press/.test(n))return{primary:['front_delts','triceps'],secondary:['upper_chest','core']};
    if(/dip|dips/.test(n))return{primary:['chest','triceps'],secondary:['front_delts']};
    if(/push-up|push up/.test(n))return{primary:['chest','triceps'],secondary:['front_delts','core']};
    if(/triceps/.test(n))return{primary:['triceps'],secondary:[]};
    return{primary:['chest','front_delts','triceps'],secondary:[]};
  }
  if(category==='pull'){
    if(/pull-up|pull up|chin-up|chin up|pulldown|pull-down/.test(n))return{primary:['lats','upper_back'],secondary:['biceps','rear_delts']};
    if(/dead hang/.test(n))return{primary:['grip','lats'],secondary:['shoulders']};
    return{primary:['upper_back','lats'],secondary:['biceps','rear_delts']};
  }
  if(category==='core'){
    if(/pallof/.test(n))return{primary:['obliques','core'],secondary:['shoulders']};
    if(/hanging leg raise|ab wheel|crunch|dead bug/.test(n))return{primary:['abs','core'],secondary:['obliques']};
    return{primary:['core'],secondary:['abs','obliques']};
  }
  if(category==='isolation'){
    if(/curl/.test(n))return{primary:['biceps'],secondary:['forearms']};
    if(/lateral raise/.test(n))return{primary:['side_delts'],secondary:['upper_traps']};
    if(/skull crushers|triceps/.test(n))return{primary:['triceps'],secondary:[]};
    return{primary:['target_muscle'],secondary:[]};
  }
  return{primary:['general'],secondary:[]};
}

function exerciseEntry(name,config){
  return Object.assign({name},config||{});
}

// These entries are now the primary source of truth for common lifts.
// Regex inference still exists, but only as a fallback for older or less
// important names that are not explicitly modeled yet.
const CORE_EXERCISE_ENTRIES=[
  exerciseEntry('Squat',{aliases:['Back Squat','Barbell Back Squat','Takakyykky'],category:'squat',movementTags:['squat'],equipmentTags:['barbell'],primaryMuscles:['quads','glutes'],secondaryMuscles:['hamstrings','core'],featured:true,popularity:100}),
  exerciseEntry('Front Squat',{aliases:['Etukyykky'],category:'squat',movementTags:['squat'],equipmentTags:['barbell'],primaryMuscles:['quads','glutes'],secondaryMuscles:['upper_back','core'],featured:true,popularity:82}),
  exerciseEntry('Paused Squat',{aliases:['Pause Squat','Pysaytyskyykky'],category:'squat',movementTags:['squat'],equipmentTags:['barbell'],primaryMuscles:['quads','glutes'],secondaryMuscles:['hamstrings','core'],popularity:60}),
  exerciseEntry('Leg Press',{aliases:['Machine Leg Press','Jalkaprassi'],category:'squat',movementTags:['squat'],equipmentTags:['machine'],primaryMuscles:['quads','glutes'],secondaryMuscles:['hamstrings'],featured:true,popularity:65}),
  exerciseEntry('Bulgarian Split Squats',{aliases:['Bulgarian Split Squat','Bulgarialainen haarakyykky'],category:'squat',movementTags:['squat','single_leg'],equipmentTags:['dumbbell','bodyweight'],primaryMuscles:['quads','glutes'],secondaryMuscles:['hamstrings','core'],featured:true,popularity:58}),
  exerciseEntry('Walking Lunges',{aliases:['Kavelyaskelkyykky'],category:'squat',movementTags:['squat','single_leg'],equipmentTags:['dumbbell','bodyweight'],primaryMuscles:['quads','glutes'],secondaryMuscles:['hamstrings','core'],popularity:36}),
  exerciseEntry('Reverse Lunges',{aliases:['Taakseaskellus'],category:'squat',movementTags:['squat','single_leg'],equipmentTags:['dumbbell','bodyweight'],primaryMuscles:['quads','glutes'],secondaryMuscles:['hamstrings','core'],popularity:34}),
  exerciseEntry('Step-Ups',{aliases:['Step Ups','Askelkyykky (koroke)'],category:'squat',movementTags:['squat','single_leg'],equipmentTags:['dumbbell','bodyweight'],primaryMuscles:['quads','glutes'],secondaryMuscles:['hamstrings','core'],popularity:30}),
  exerciseEntry('Bench Press',{aliases:['Bench','Barbell Bench Press','Penkkipunnerrus'],category:'press',movementTags:['horizontal_press'],equipmentTags:['barbell'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[],featured:true,popularity:100}),
  exerciseEntry('Close-Grip Bench',{aliases:['Close-Grip Bench Press','Kapean otteen penkkipunnerrus'],category:'press',movementTags:['horizontal_press'],equipmentTags:['barbell'],primaryMuscles:['chest','triceps'],secondaryMuscles:['front_delts'],popularity:54}),
  exerciseEntry('Incline Press',{aliases:['Vinopenkkipunnerrus'],category:'press',movementTags:['horizontal_press'],equipmentTags:['barbell'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:['upper_chest'],featured:true,popularity:50}),
  exerciseEntry('DB Bench',{aliases:['Dumbbell Bench Press','Dumbbell Bench','Penkkipunnerrus (kasipainot)'],category:'press',movementTags:['horizontal_press'],equipmentTags:['dumbbell'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[],featured:true,popularity:56}),
  exerciseEntry('DB Incline Press',{aliases:['Dumbbell Incline Press','Vinopenkkipunnerrus (kasipainot)'],category:'press',movementTags:['horizontal_press'],equipmentTags:['dumbbell'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:['upper_chest'],popularity:34}),
  exerciseEntry('Machine Chest Press',{aliases:['Rintapunnerrus (laite)'],category:'press',movementTags:['horizontal_press'],equipmentTags:['machine'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[],popularity:28}),
  exerciseEntry('Push-ups',{aliases:['Push Ups','Punnerrukset'],category:'press',movementTags:['horizontal_press'],equipmentTags:['bodyweight'],primaryMuscles:['chest','triceps'],secondaryMuscles:['front_delts','core'],featured:true,popularity:48}),
  exerciseEntry('Dips',{aliases:['Dipsit'],category:'press',movementTags:['vertical_press'],equipmentTags:['bodyweight'],primaryMuscles:['chest','triceps'],secondaryMuscles:['front_delts'],featured:true,popularity:44}),
  exerciseEntry('Deadlift',{aliases:['Maastaveto'],category:'hinge',movementTags:['hinge'],equipmentTags:['barbell'],primaryMuscles:['hamstrings','glutes','lower_back'],secondaryMuscles:['upper_back','core'],featured:true,popularity:100}),
  exerciseEntry('Sumo Deadlift',{aliases:['Sumomaastaveto'],category:'hinge',movementTags:['hinge'],equipmentTags:['barbell'],primaryMuscles:['glutes','adductors','quads'],secondaryMuscles:['hamstrings','core'],featured:true,popularity:60}),
  exerciseEntry('Romanian Deadlift',{aliases:['Romanian Deadlifts (RDL)','Romanialainen maastaveto'],category:'hinge',movementTags:['hinge'],equipmentTags:['barbell'],primaryMuscles:['hamstrings','glutes'],secondaryMuscles:['lower_back','core'],featured:true,popularity:68}),
  exerciseEntry('Trap Bar Deadlift',{aliases:['Trap bar -maastaveto'],category:'hinge',movementTags:['hinge'],equipmentTags:['trap_bar'],primaryMuscles:['quads','glutes','hamstrings'],secondaryMuscles:['core'],popularity:26}),
  exerciseEntry('Good Morning',{aliases:['Good Mornings'],category:'hinge',movementTags:['hinge'],equipmentTags:['barbell'],primaryMuscles:['hamstrings','glutes','lower_back'],secondaryMuscles:['core'],popularity:24}),
  exerciseEntry('Back Extensions',{aliases:['Selan ojennus'],category:'hinge',movementTags:['hinge'],equipmentTags:['bodyweight'],primaryMuscles:['glutes','hamstrings','lower_back'],secondaryMuscles:['core'],featured:true,popularity:28}),
  exerciseEntry('45deg Hip Extensions',{aliases:['45° Hip Extensions','45° lonkan ojennus'],category:'hinge',movementTags:['hinge'],equipmentTags:['bodyweight'],primaryMuscles:['glutes','hamstrings','lower_back'],secondaryMuscles:['core'],popularity:20}),
  exerciseEntry('Hamstring Curls',{aliases:['Takareiden koukistus'],category:'hinge',movementTags:['hinge','isolation'],equipmentTags:['machine'],primaryMuscles:['hamstrings'],secondaryMuscles:['calves'],popularity:32}),
  exerciseEntry('OHP',{aliases:['Overhead Press','Overhead Press (OHP)','Pystypunnerrus'],category:'press',movementTags:['vertical_press'],equipmentTags:['barbell'],primaryMuscles:['front_delts','triceps'],secondaryMuscles:['upper_chest','core'],featured:true,popularity:72}),
  exerciseEntry('Push Press',{aliases:['Tyontopunnerrus'],category:'press',movementTags:['vertical_press'],equipmentTags:['barbell'],primaryMuscles:['front_delts','triceps'],secondaryMuscles:['quads','glutes','core'],popularity:28}),
  exerciseEntry('DB OHP',{aliases:['Overhead Dumbbell Press','Pystypunnerrus (kasipainot)'],category:'press',movementTags:['vertical_press'],equipmentTags:['dumbbell'],primaryMuscles:['front_delts','triceps'],secondaryMuscles:['upper_chest','core'],popularity:30}),
  exerciseEntry('Barbell Rows',{aliases:['Barbell Row','Kulmasoutu'],category:'pull',movementTags:['horizontal_pull'],equipmentTags:['barbell'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts'],featured:true,popularity:66}),
  exerciseEntry('Dumbbell Rows',{aliases:['Dumbbell Row','DB Rows','DB Row','Kasipainosoutu'],category:'pull',movementTags:['horizontal_pull'],equipmentTags:['dumbbell'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts'],featured:true,popularity:54}),
  exerciseEntry('Chest-Supported Rows',{aliases:['Chest Supported Rows','Rintatuettu soutu'],category:'pull',movementTags:['horizontal_pull'],equipmentTags:['machine','dumbbell'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts'],popularity:34}),
  exerciseEntry('Seated Cable Rows',{aliases:['Taljasoutu istuen'],category:'pull',movementTags:['horizontal_pull'],equipmentTags:['cable'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts'],featured:true,popularity:38}),
  exerciseEntry('Machine Rows',{aliases:['Soutulaite'],category:'pull',movementTags:['horizontal_pull'],equipmentTags:['machine'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts'],popularity:20}),
  exerciseEntry('T-Bar Rows',{aliases:['T-tankosoutu'],category:'pull',movementTags:['horizontal_pull'],equipmentTags:['barbell','machine'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts'],popularity:24}),
  exerciseEntry('Pull-ups',{aliases:['Pull Ups','Leuanveto (ylikaden ote)'],category:'pull',movementTags:['vertical_pull'],equipmentTags:['pullup_bar','bodyweight'],primaryMuscles:['lats','upper_back'],secondaryMuscles:['biceps','rear_delts'],featured:true,popularity:48}),
  exerciseEntry('Chin-ups',{aliases:['Chin Ups','Leuanveto (myotaote)'],category:'pull',movementTags:['vertical_pull'],equipmentTags:['pullup_bar','bodyweight'],primaryMuscles:['lats','upper_back'],secondaryMuscles:['biceps','rear_delts'],featured:true,popularity:46}),
  exerciseEntry('Neutral-Grip Pull-ups',{aliases:['Neutral Grip Pull-ups','Leuanveto (neutraaliote)'],category:'pull',movementTags:['vertical_pull'],equipmentTags:['pullup_bar','bodyweight'],primaryMuscles:['lats','upper_back'],secondaryMuscles:['biceps','rear_delts'],popularity:28}),
  exerciseEntry('Assisted Chin-ups',{aliases:['Avustettu leuanveto'],category:'pull',movementTags:['vertical_pull'],equipmentTags:['pullup_bar','bodyweight','machine'],primaryMuscles:['lats','upper_back'],secondaryMuscles:['biceps','rear_delts'],popularity:18}),
  exerciseEntry('Pull-downs',{aliases:['Lat Pulldowns','Lat Pulldown','Lat Pull-down','Lat Pull-down (Wide Grip)','Lat Pull-down (Close Grip)','Alasvedot'],category:'pull',movementTags:['vertical_pull'],equipmentTags:['cable'],primaryMuscles:['lats','upper_back'],secondaryMuscles:['biceps','rear_delts'],featured:true,popularity:44}),
  exerciseEntry('Weighted Planks',{aliases:['Painollinen lankku'],category:'core',movementTags:['core'],equipmentTags:['bodyweight'],primaryMuscles:['core','abs'],secondaryMuscles:['obliques'],featured:true,popularity:26}),
  exerciseEntry('Pallof Press',{aliases:['Pallof-punnerrus'],category:'core',movementTags:['core'],equipmentTags:['cable','band'],primaryMuscles:['obliques','core'],secondaryMuscles:['shoulders'],popularity:18}),
  exerciseEntry('Ab Wheel Rollouts',{aliases:['Ab Wheel','Vatsapyora'],category:'core',movementTags:['core'],equipmentTags:['bodyweight'],primaryMuscles:['abs','core'],secondaryMuscles:['lats','shoulders'],featured:true,popularity:24}),
  exerciseEntry('Hanging Leg Raises',{aliases:['Roikkuvat jalkojen nostot'],category:'core',movementTags:['core'],equipmentTags:['pullup_bar','bodyweight'],primaryMuscles:['abs','core'],secondaryMuscles:['obliques','hip_flexors'],popularity:20}),
  exerciseEntry('Cable Crunches',{aliases:['Kaapelirutistus'],category:'core',movementTags:['core'],equipmentTags:['cable'],primaryMuscles:['abs','core'],secondaryMuscles:['obliques'],popularity:18}),
  exerciseEntry('Dead Bugs',{aliases:['Dead bug'],category:'core',movementTags:['core'],equipmentTags:['bodyweight'],primaryMuscles:['core','abs'],secondaryMuscles:['obliques'],popularity:16}),
  exerciseEntry('Dumbbell Bicep Curls',{aliases:['Kasipainohauiskanto'],category:'isolation',movementTags:['isolation'],equipmentTags:['dumbbell'],primaryMuscles:['biceps'],secondaryMuscles:['forearms'],popularity:20}),
  exerciseEntry('Dumbbell Lateral Raises',{aliases:['Kasipainosivunousu'],category:'isolation',movementTags:['isolation'],equipmentTags:['dumbbell'],primaryMuscles:['side_delts'],secondaryMuscles:['upper_traps'],popularity:20}),
  exerciseEntry('Overhead Triceps Extensions',{aliases:['Ojentaja paan yli'],category:'isolation',movementTags:['isolation'],equipmentTags:['dumbbell','cable'],primaryMuscles:['triceps'],secondaryMuscles:[],popularity:16})
];

const EXERCISE_METADATA_OVERRIDES={
  'bench press':{movementTags:['horizontal_press'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[]},
  'barbell bench press':{movementTags:['horizontal_press'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[]},
  'barbell row':{movementTags:['horizontal_pull'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts']},
  'barbell rows':{movementTags:['horizontal_pull'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts']},
  'deadlift':{movementTags:['hinge'],primaryMuscles:['hamstrings','glutes','lower_back'],secondaryMuscles:['upper_back','core']},
  'sumo deadlift':{movementTags:['hinge'],primaryMuscles:['glutes','adductors','quads'],secondaryMuscles:['hamstrings','core']},
  'front squat':{movementTags:['squat'],primaryMuscles:['quads','glutes'],secondaryMuscles:['upper_back','core']},
  'ohp':{movementTags:['vertical_press'],primaryMuscles:['front_delts','triceps'],secondaryMuscles:['upper_chest','core']},
  'overhead press (ohp)':{movementTags:['vertical_press'],primaryMuscles:['front_delts','triceps'],secondaryMuscles:['upper_chest','core']},
  'push press':{movementTags:['vertical_press'],primaryMuscles:['front_delts','triceps'],secondaryMuscles:['quads','glutes','core']},
  'weighted planks':{movementTags:['core'],primaryMuscles:['core','abs'],secondaryMuscles:['obliques']},
  'ab wheel rollouts':{movementTags:['core'],primaryMuscles:['abs','core'],secondaryMuscles:['lats','shoulders']},
  'dips':{movementTags:['vertical_press'],primaryMuscles:['chest','triceps'],secondaryMuscles:['front_delts']}
};

function buildExerciseMetadata(name,category,entry){
  const inferredMuscles=inferMuscleGroups(name,category);
  const override=EXERCISE_METADATA_OVERRIDES[normalize(name)]||{};
  const primaryMuscles=uniqueList(entry.primaryMuscles||override.primaryMuscles||inferredMuscles.primary);
  const secondaryMuscles=uniqueList(entry.secondaryMuscles||override.secondaryMuscles||inferredMuscles.secondary);
  return{
    primaryMuscles,
    secondaryMuscles,
    displayMuscleGroups:getDisplayMuscleGroups(primaryMuscles,secondaryMuscles),
    movementTags:uniqueList(entry.movementTags||override.movementTags||inferMovementTags(name,category)),
    equipmentTags:uniqueList(entry.equipmentTags||override.equipmentTags||inferEquipmentTags(name))
  };
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

function getLocaleAliases(name){
  const aliases=[];
  Object.keys(localizedNameByLocale).forEach(locale=>{
    const localized=localizedNameByLocale[locale]?.[normalize(name)];
    if(localized)aliases.push(localized);
  });
  return uniqueList(aliases);
}

function registerLookupValue(value,id){
  const key=normalize(value);
  if(!key||!id)return;
  lookupByName[key]=id;
}

function registerExercise(entry){
  if(!entry||!entry.name)return null;
  const id=entry.id||slugify(entry.name);
  const existing=catalogById[id];
  if(existing)return existing;
  const category=entry.category||inferCategory(entry.name);
  const guidance=entry.guidance||guidanceFor(entry.name,category);
  const metadata=buildExerciseMetadata(entry.name,category,entry);
  const aliases=uniqueList([...(Array.isArray(entry.aliases)?entry.aliases:[]),...getLocaleAliases(entry.name)]);
  const record={
    id,
    name:entry.name,
    category,
    aliases,
    guidance,
    primaryMuscles:metadata.primaryMuscles,
    secondaryMuscles:metadata.secondaryMuscles,
    displayMuscleGroups:metadata.displayMuscleGroups,
    movementTags:metadata.movementTags,
    equipmentTags:metadata.equipmentTags,
    featured:!!entry.featured,
    popularity:Number(entry.popularity||0)
  };
  catalogById[id]=record;
  registerLookupValue(record.name,id);
  record.aliases.forEach(alias=>registerLookupValue(alias,id));
  return record;
}

function registerAlias(alias,target){
  const id=resolveExerciseId(target);
  if(!id)return;
  registerLookupValue(alias,id);
  const record=catalogById[id];
  if(record&&!record.aliases.includes(alias))record.aliases.push(alias);
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

// Unknown custom exercise names should still produce inferred metadata and
// guidance so old logs, history and dashboard load calculations keep working.
function buildVirtualExerciseRecord(input){
  const raw=typeof input==='object'?String(input?.name||'').trim():String(input||'').trim();
  if(!raw)return null;
  const category=inferCategory(raw);
  const metadata=buildExerciseMetadata(raw,category,{});
  return{
    id:null,
    name:raw,
    category,
    aliases:getLocaleAliases(raw),
    guidance:guidanceFor(raw,category),
    primaryMuscles:metadata.primaryMuscles,
    secondaryMuscles:metadata.secondaryMuscles,
    displayMuscleGroups:metadata.displayMuscleGroups,
    movementTags:metadata.movementTags,
    equipmentTags:metadata.equipmentTags,
    featured:false,
    popularity:0
  };
}

function getExerciseRecord(input){
  return getExercise(input)||buildVirtualExerciseRecord(input);
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
  const exercise=getExerciseRecord(input);
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

function getExerciseMeta(input,locale){
  const exercise=getExerciseRecord(input);
  if(!exercise)return null;
  return{
    id:exercise.id,
    name:getDisplayName(exercise.name,locale),
    canonicalName:exercise.name,
    category:exercise.category,
    primaryMuscles:(exercise.primaryMuscles||[]).slice(),
    secondaryMuscles:(exercise.secondaryMuscles||[]).slice(),
    displayMuscleGroups:(exercise.displayMuscleGroups||[]).slice(),
    movementTags:(exercise.movementTags||[]).slice(),
    equipmentTags:(exercise.equipmentTags||[]).slice()
  };
}

function getAllExercises(){
  return Object.values(catalogById);
}

function matchesAny(items,needles){
  const list=arrayify(needles).map(normalize).filter(Boolean);
  if(!list.length)return true;
  const haystack=new Set((items||[]).map(normalize));
  return list.some(item=>haystack.has(item));
}

function matchesFilters(record,filters){
  const next=filters||{};
  const includeIds=new Set(arrayify(next.includeIds));
  const excludeIds=new Set(arrayify(next.excludeIds));
  if(includeIds.size&&!includeIds.has(record.id))return false;
  if(excludeIds.has(record.id))return false;
  if(next.featuredOnly&&!record.featured)return false;
  if(arrayify(next.categories).length&&!arrayify(next.categories).map(normalize).includes(normalize(record.category)))return false;
  if(!matchesAny(record.movementTags,next.movementTags))return false;
  if(!matchesAny(record.equipmentTags,next.equipmentTags))return false;
  if(!matchesAny(record.displayMuscleGroups,next.muscleGroups))return false;
  return true;
}

function cloneRecord(record){
  return{
    id:record.id,
    name:record.name,
    category:record.category,
    aliases:(record.aliases||[]).slice(),
    primaryMuscles:(record.primaryMuscles||[]).slice(),
    secondaryMuscles:(record.secondaryMuscles||[]).slice(),
    displayMuscleGroups:(record.displayMuscleGroups||[]).slice(),
    movementTags:(record.movementTags||[]).slice(),
    equipmentTags:(record.equipmentTags||[]).slice(),
    featured:!!record.featured,
    popularity:record.popularity||0
  };
}

function scoreSearch(record,query){
  const q=normalize(query);
  if(!q)return 0;
  const names=[record.name,...(record.aliases||[])];
  let score=0;
  names.forEach(name=>{
    const normalizedName=normalize(name);
    if(normalizedName===q)score=Math.max(score,100);
    else if(normalizedName.startsWith(q))score=Math.max(score,70);
    else if(normalizedName.includes(q))score=Math.max(score,40);
  });
  if(score)score+=(record.featured?6:0)+Math.min(20,Math.round((record.popularity||0)/5));
  return score;
}

function sortRecords(records,sort){
  const next=records.slice();
  if(sort==='name')return next.sort((a,b)=>a.name.localeCompare(b.name));
  if(sort==='popularity')return next.sort((a,b)=>(b.popularity||0)-(a.popularity||0)||a.name.localeCompare(b.name));
  return next.sort((a,b)=>{
    const featuredDiff=(b.featured===true)-(a.featured===true);
    if(featuredDiff)return featuredDiff;
    const popularityDiff=(b.popularity||0)-(a.popularity||0);
    if(popularityDiff)return popularityDiff;
    return a.name.localeCompare(b.name);
  });
}

// UI-agnostic catalog search for future list/swap pickers.
function searchExercises(query,filters){
  const q=String(query||'').trim();
  const limit=Math.max(1,Number(filters?.limit||50));
  return Object.values(catalogById)
    .filter(record=>matchesFilters(record,filters))
    .map(record=>({record,score:scoreSearch(record,q)}))
    .filter(item=>!q||item.score>0)
    .sort((a,b)=>b.score-a.score||(b.record.popularity||0)-(a.record.popularity||0)||a.record.name.localeCompare(b.record.name))
    .slice(0,limit)
    .map(item=>cloneRecord(item.record));
}

function getExerciseList(options){
  const next=options||{};
  return sortRecords(Object.values(catalogById).filter(record=>matchesFilters(record,next.filters)),next.sort||'featured')
    .map(cloneRecord);
}

function getRelatedExercises(exerciseId,options){
  const base=getExercise(exerciseId);
  if(!base)return [];
  const next=options||{};
  const sameMovement=next.sameMovement!==false;
  const sameEquipment=!!next.sameEquipment;
  const exclude=new Set([base.id,...arrayify(next.excludeIds)]);
  const limit=Math.max(1,Number(next.limit||8));
  return Object.values(catalogById)
    .filter(record=>!exclude.has(record.id))
    .map(record=>{
      const sharedMovement=record.movementTags.filter(tag=>base.movementTags.includes(tag));
      const sharedEquipment=record.equipmentTags.filter(tag=>base.equipmentTags.includes(tag));
      const sharedMuscles=record.displayMuscleGroups.filter(tag=>base.displayMuscleGroups.includes(tag));
      if(sameMovement&&!sharedMovement.length)return null;
      if(sameEquipment&&!sharedEquipment.length)return null;
      return{
        record,
        score:sharedMovement.length*30+sharedEquipment.length*15+sharedMuscles.length*8+(record.featured?5:0)+(record.popularity||0)/10
      };
    })
    .filter(Boolean)
    .sort((a,b)=>b.score-a.score||a.record.name.localeCompare(b.record.name))
    .slice(0,limit)
    .map(item=>cloneRecord(item.record));
}

const FALLBACK_EXERCISE_NAMES=[
  'Overhead Press (OHP)','High Bar Squat','Beltless Squat','Wider Stance Squat','Narrower Stance Squat','Box Squat','Pin Squat','Half Squat','Good Morning','Squat With Slow Eccentric',
  'Long Pause Bench','Spoto Press','Wider Grip Bench','Board Press','Pin Press','Slingshot Bench','Bench With Feet Up','Bench With Slow Eccentric','DB Incline Press',
  'Conventional Deadlift','Block Pull','Rack Pull','Deficit Deadlift','Stiff Leg Deadlift','Snatch Grip Deadlift','Behind The Neck OHP','Seated OHP',
  'Chest Supported Rows','Chest-Supported Rows','T-Bar Rows','Neutral Grip Pull-ups','Neutral-Grip Pull-ups','Assisted Chin-ups','Machine Rows',
  'Bodyweight Squats','Barbell Row','Barbell Back Squat','Machine Leg Press','Dumbbell Lunges','Close-Grip Push-ups','Barbell Romanian Deadlift','Dumbbell Romanian Deadlift','Dumbbell Glute Bridges','45deg Hip Extensions',
  'Band Pull-Aparts','Dead Hangs','Ab Crunches','Hanging Leg Raises','Dead Bugs','Skull Crushers','Cable Triceps Pressdowns'
];

CORE_EXERCISE_ENTRIES.forEach(entry=>registerExercise(entry));
FALLBACK_EXERCISE_NAMES.forEach(name=>registerExercise({name}));

[
  ['overhead press','OHP'],
  ['pystypunnerrus','OHP'],
  ['db row','Dumbbell Rows'],
  ['db rows','Dumbbell Rows'],
  ['kasipainosoutu','Dumbbell Rows'],
  ['pause squat','Paused Squat'],
  ['pysaytyskyykky','Paused Squat'],
  ['lat pulldown','Pull-downs'],
  ['lat pull-down','Pull-downs'],
  ['alasvedot','Pull-downs'],
  ['takakyykky','Squat'],
  ['penkki','Bench Press'],
  ['penkkipunnerrus','Bench Press'],
  ['maastaveto','Deadlift'],
  ['sumomaastaveto','Sumo Deadlift'],
  ['romanialainen maastaveto','Romanian Deadlift'],
  ['etukyykky','Front Squat'],
  ['vatsapyora','Ab Wheel Rollouts'],
  ['good mornings','Good Morning'],
  ['machine chest press','Machine Chest Press'],
  ['chest supported rows','Chest-Supported Rows'],
  ['neutral grip pull-ups','Neutral-Grip Pull-ups'],
  ['45° hip extensions','45deg Hip Extensions'],
  ['45Â° hip extensions','45deg Hip Extensions'],
  ['walking lunges','Walking Lunges'],
  ['reverse lunges','Reverse Lunges'],
  ['step ups','Step-Ups']
].forEach(([alias,target])=>registerAlias(alias,target));

window.EXERCISE_LIBRARY={
  resolveExerciseId,
  getExercise,
  getExerciseMeta,
  mapMuscleToDisplayGroup,
  getDisplayName,
  getExerciseGuidance,
  getAllExercises,
  searchExercises,
  getExerciseList,
  getRelatedExercises,
  registerExercise,
  registerAlias
};
})();
