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
    'paused squat':'Pysäytyskyykky',
    'pause squat':'Pysäytyskyykky',
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
    'push press':'Työntöpunnerrus',
    'barbell rows':'Kulmasoutu',
    'barbell row':'Kulmasoutu',
    'romanian deadlifts (rdl)':'Romanialaiset maastavedot',
    'romanian deadlift':'Romanialainen maastaveto',
    'barbell romanian deadlift':'Romanialainen maastaveto tangolla',
    'dumbbell romanian deadlift':'Romanialainen maastaveto käsipainoilla',
    'bulgarian split squats':'Bulgarialainen askelkyykky',
    'bulgarian split squat':'Bulgarialainen askelkyykky',
    'dumbbell rows':'Käsipainosoutu',
    'dumbbell row':'Käsipainosoutu',
    'db rows':'Käsipainosoutu',
    'db row':'Käsipainosoutu',
    'db incline press':'Vinopenkkipunnerrus käsipainoilla',
    'dumbbell bench press':'Penkkipunnerrus käsipainoilla',
    'dumbbell bench':'Penkkipunnerrus käsipainoilla',
    'machine chest press':'Rintapunnerrus laitteella',
    'chin-ups':'Leuanveto vastaotteella',
    'chin ups':'Leuanveto vastaotteella',
    'pull-ups':'Leuanveto myötäotteella',
    'pull ups':'Leuanveto myötäotteella',
    'neutral grip pull-ups':'Leuanveto neutraalilla otteella',
    'neutral-grip pull-ups':'Leuanveto neutraalilla otteella',
    'assisted chin-ups':'Avustettu leuanveto',
    'lat pulldowns':'Ylätalja',
    'lat pull-down (wide grip)':'Ylätalja (leveä ote)',
    'lat pull-down (close grip)':'Ylätalja (kapea ote)',
    'lat pull-down':'Ylätalja',
    'pull-downs':'Ylätalja',
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
    'dumbbell lunges':'Askelkyykky käsipainoilla',
    'walking lunges':'Kävelyaskelkyykky',
    'reverse lunges':'Askelkyykky taaksepäin',
    'step-ups':'Korokkeelle nousu',
    'step ups':'Korokkeelle nousu',
    'dumbbell glute bridges':'Pakarasilta käsipainolla',
    'back extensions':'Selänojennus',
    '45° hip extensions':'45° lonkan ojennus',
    '45deg hip extensions':'45° lonkan ojennus',
    'hamstring curls':'Takareiden koukistus',
    'dumbbell bicep curls':'Hauiskääntö käsipainoilla',
    'dumbbell lateral raises':'Käsipainosivunosto',
    'overhead dumbbell press':'Pystypunnerrus käsipainoilla',
    'overhead triceps extensions':'Ojentajapunnerrus pään yli',
    'skull crushers':'Ojentajapunnerrus makuulla',
    'cable triceps pressdowns':'Ojentajapunnerrus taljassa',
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
    'good morning':'Hyvää huomenta',
    'squat with slow eccentric':'Kyykky hitaalla laskulla',
    'long pause bench':'Penkkipunnerrus pitkällä pysäytyksellä',
    'wider grip bench':'Leveän otteen penkkipunnerrus',
    'board press':'Lautapunnerrus',
    'pin press':'Pin-punnerrus',
    'slingshot bench':'Slingshot-penkkipunnerrus',
    'bench with feet up':'Penkkipunnerrus jalat ylhäällä',
    'bench with slow eccentric':'Penkkipunnerrus hitaalla laskulla',
    'db bench':'Penkkipunnerrus käsipainoilla',
    'conventional deadlift':'Perinteinen maastaveto',
    'block pull':'Blokilta maastaveto',
    'rack pull':'Telineveto',
    'deficit deadlift':'Korokkeelta maastaveto',
    'snatch grip deadlift':'Tempausotteen maastaveto',
    'trap bar deadlift':'Trap bar -maastaveto',
    'behind the neck ohp':'Pystypunnerrus niskan takaa',
    'seated ohp':'Pystypunnerrus istuen',
    'db ohp':'Pystypunnerrus käsipainoilla'
  }
};

function normalize(value){
  return String(value||'')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ');
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
  if(/bicep curl|lateral raise|skull crusher|pressdown|triceps extension/.test(n))return 'isolation';
  if(/squat|leg press|lunge|step-up/.test(n))return 'squat';
  if(/deadlift|romanian|rdl|hinge|good morning|glute bridge|hamstring|hip extension/.test(n))return 'hinge';
  if(/pull apart/.test(n))return 'pull';
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
  if(/pull apart/.test(n)&&!tags.includes('horizontal_pull'))tags.push('horizontal_pull');
  if(/lunge|split squat|step-up|step ups|reverse lunges/.test(n))tags.push('single_leg');
  if(/bench|press|dip|push-up|push up/.test(n)&&!tags.includes('horizontal_press')&&!tags.includes('vertical_press'))tags.push('press');
  if(/row|pull/.test(n)&&!tags.includes('horizontal_pull')&&!tags.includes('vertical_pull'))tags.push('pull');
  return uniqueList(tags.length?tags:[category||'general']);
}

function inferEquipmentTags(name){
  const n=normalize(name);
  const tags=[];
  const isBodyweightSquat=/bodyweight squat/.test(n);
  if(!isBodyweightSquat&&/barbell|bench press|squat|deadlift|ohp|good morning|row|board press|pin press/.test(n))tags.push('barbell');
  if(/dumbbell|db /.test(n))tags.push('dumbbell');
  if(/machine|leg press|hamstring curls|machine rows|machine chest press/.test(n))tags.push('machine');
  if(/cable|pulldown|pull-down|pressdown/.test(n))tags.push('cable');
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
    if(/pull apart/.test(n))return{primary:['rear_delts','upper_back'],secondary:['shoulders']};
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
    if(/skull crusher|pressdown|triceps extension|skull crushers|triceps/.test(n))return{primary:['triceps'],secondary:[]};
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
  exerciseEntry('Paused Squat',{aliases:['Pause Squat','Pysäytyskyykky'],category:'squat',movementTags:['squat'],equipmentTags:['barbell'],primaryMuscles:['quads','glutes'],secondaryMuscles:['hamstrings','core'],popularity:60}),
  exerciseEntry('Leg Press',{aliases:['Machine Leg Press','Jalkaprässi'],category:'squat',movementTags:['squat'],equipmentTags:['machine'],primaryMuscles:['quads','glutes'],secondaryMuscles:['hamstrings'],featured:true,popularity:65}),
  exerciseEntry('Bulgarian Split Squats',{aliases:['Bulgarian Split Squat','Bulgarialainen askelkyykky'],category:'squat',movementTags:['squat','single_leg'],equipmentTags:['dumbbell','bodyweight'],primaryMuscles:['quads','glutes'],secondaryMuscles:['hamstrings','core'],featured:true,popularity:58}),
  exerciseEntry('Walking Lunges',{aliases:['Kävelyaskelkyykky'],category:'squat',movementTags:['squat','single_leg'],equipmentTags:['dumbbell','bodyweight'],primaryMuscles:['quads','glutes'],secondaryMuscles:['hamstrings','core'],popularity:36}),
  exerciseEntry('Reverse Lunges',{aliases:['Askelkyykky taaksepäin'],category:'squat',movementTags:['squat','single_leg'],equipmentTags:['dumbbell','bodyweight'],primaryMuscles:['quads','glutes'],secondaryMuscles:['hamstrings','core'],popularity:34}),
  exerciseEntry('Step-Ups',{aliases:['Step Ups','Korokkeelle nousu'],category:'squat',movementTags:['squat','single_leg'],equipmentTags:['dumbbell','bodyweight'],primaryMuscles:['quads','glutes'],secondaryMuscles:['hamstrings','core'],popularity:30}),
  exerciseEntry('Bench Press',{aliases:['Bench','Barbell Bench Press','Penkkipunnerrus'],category:'press',movementTags:['horizontal_press'],equipmentTags:['barbell'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[],featured:true,popularity:100}),
  exerciseEntry('Close-Grip Bench',{aliases:['Close-Grip Bench Press','Kapean otteen penkkipunnerrus'],category:'press',movementTags:['horizontal_press'],equipmentTags:['barbell'],primaryMuscles:['chest','triceps'],secondaryMuscles:['front_delts'],popularity:54}),
  exerciseEntry('Incline Press',{aliases:['Vinopenkkipunnerrus'],category:'press',movementTags:['horizontal_press'],equipmentTags:['barbell'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[],featured:true,popularity:50}),
  exerciseEntry('DB Bench',{aliases:['Dumbbell Bench Press','Dumbbell Bench','Penkkipunnerrus käsipainoilla'],category:'press',movementTags:['horizontal_press'],equipmentTags:['dumbbell'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[],featured:true,popularity:56}),
  exerciseEntry('DB Incline Press',{aliases:['Dumbbell Incline Press','Vinopenkkipunnerrus käsipainoilla'],category:'press',movementTags:['horizontal_press'],equipmentTags:['dumbbell'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[],popularity:34}),
  exerciseEntry('Machine Chest Press',{aliases:['Rintapunnerrus laitteella'],category:'press',movementTags:['horizontal_press'],equipmentTags:['machine'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[],popularity:28}),
  exerciseEntry('Push-ups',{aliases:['Push Ups','Punnerrukset'],category:'press',movementTags:['horizontal_press'],equipmentTags:['bodyweight'],primaryMuscles:['chest','triceps'],secondaryMuscles:['front_delts','core'],featured:true,popularity:48}),
  exerciseEntry('Dips',{aliases:['Dipsit'],category:'press',movementTags:['vertical_press'],equipmentTags:['bodyweight'],primaryMuscles:['chest','triceps'],secondaryMuscles:['front_delts'],featured:true,popularity:44}),
  exerciseEntry('Deadlift',{aliases:['Maastaveto'],category:'hinge',movementTags:['hinge'],equipmentTags:['barbell'],primaryMuscles:['hamstrings','glutes','lower_back'],secondaryMuscles:['upper_back','core','grip'],featured:true,popularity:100}),
  exerciseEntry('Sumo Deadlift',{aliases:['Sumomaastaveto'],category:'hinge',movementTags:['hinge'],equipmentTags:['barbell'],primaryMuscles:['glutes','adductors','quads'],secondaryMuscles:['hamstrings','core'],featured:true,popularity:60}),
  exerciseEntry('Romanian Deadlift',{aliases:['Romanian Deadlifts (RDL)','Romanialainen maastaveto'],category:'hinge',movementTags:['hinge'],equipmentTags:['barbell'],primaryMuscles:['hamstrings','glutes'],secondaryMuscles:['lower_back','core'],featured:true,popularity:68}),
  exerciseEntry('Trap Bar Deadlift',{aliases:['Trap bar -maastaveto'],category:'hinge',movementTags:['hinge'],equipmentTags:['trap_bar'],primaryMuscles:['quads','glutes','hamstrings'],secondaryMuscles:['core'],popularity:26}),
  exerciseEntry('Good Morning',{aliases:['Good Mornings','Hyvää huomenta'],category:'hinge',movementTags:['hinge'],equipmentTags:['barbell'],primaryMuscles:['hamstrings','glutes','lower_back'],secondaryMuscles:['core'],popularity:24}),
  exerciseEntry('Back Extensions',{aliases:['Selänojennus'],category:'hinge',movementTags:['hinge'],equipmentTags:['bodyweight'],primaryMuscles:['glutes','hamstrings','lower_back'],secondaryMuscles:['core'],featured:true,popularity:28}),
  exerciseEntry('45deg Hip Extensions',{aliases:['45° Hip Extensions','45° lonkan ojennus'],category:'hinge',movementTags:['hinge'],equipmentTags:['bodyweight'],primaryMuscles:['glutes','hamstrings','lower_back'],secondaryMuscles:['core'],popularity:20}),
  exerciseEntry('Hamstring Curls',{aliases:['Takareiden koukistus'],category:'hinge',movementTags:['hinge','isolation'],equipmentTags:['machine'],primaryMuscles:['hamstrings'],secondaryMuscles:['calves'],popularity:32}),
  exerciseEntry('OHP',{aliases:['Overhead Press','Overhead Press (OHP)','Pystypunnerrus'],category:'press',movementTags:['vertical_press'],equipmentTags:['barbell'],primaryMuscles:['front_delts','triceps'],secondaryMuscles:['upper_chest','core'],featured:true,popularity:72}),
  exerciseEntry('Push Press',{aliases:['Työntöpunnerrus'],category:'press',movementTags:['vertical_press'],equipmentTags:['barbell'],primaryMuscles:['front_delts','triceps'],secondaryMuscles:['quads','glutes','core'],popularity:28}),
  exerciseEntry('DB OHP',{aliases:['Overhead Dumbbell Press','Pystypunnerrus käsipainoilla'],category:'press',movementTags:['vertical_press'],equipmentTags:['dumbbell'],primaryMuscles:['front_delts','triceps'],secondaryMuscles:['upper_chest','core'],popularity:30}),
  exerciseEntry('Barbell Rows',{aliases:['Barbell Row','Kulmasoutu'],category:'pull',movementTags:['horizontal_pull'],equipmentTags:['barbell'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts'],featured:true,popularity:66}),
  exerciseEntry('Dumbbell Rows',{aliases:['Dumbbell Row','DB Rows','DB Row','Käsipainosoutu'],category:'pull',movementTags:['horizontal_pull'],equipmentTags:['dumbbell'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts'],featured:true,popularity:54}),
  exerciseEntry('Chest-Supported Rows',{aliases:['Chest Supported Rows','Rintatuettu soutu'],category:'pull',movementTags:['horizontal_pull'],equipmentTags:['machine','dumbbell'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts'],popularity:34}),
  exerciseEntry('Seated Cable Rows',{aliases:['Taljasoutu istuen'],category:'pull',movementTags:['horizontal_pull'],equipmentTags:['cable'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts'],featured:true,popularity:38}),
  exerciseEntry('Machine Rows',{aliases:['Soutulaite'],category:'pull',movementTags:['horizontal_pull'],equipmentTags:['machine'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts'],popularity:20}),
  exerciseEntry('T-Bar Rows',{aliases:['T-tankosoutu'],category:'pull',movementTags:['horizontal_pull'],equipmentTags:['barbell','machine'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts'],popularity:24}),
  exerciseEntry('Pull-ups',{aliases:['Pull Ups','Leuanveto myötäotteella'],category:'pull',movementTags:['vertical_pull'],equipmentTags:['pullup_bar','bodyweight'],primaryMuscles:['lats','upper_back'],secondaryMuscles:['biceps','rear_delts'],featured:true,popularity:48}),
  exerciseEntry('Chin-ups',{aliases:['Chin Ups','Leuanveto vastaotteella'],category:'pull',movementTags:['vertical_pull'],equipmentTags:['pullup_bar','bodyweight'],primaryMuscles:['lats','upper_back'],secondaryMuscles:['biceps','rear_delts'],featured:true,popularity:46}),
  exerciseEntry('Neutral-Grip Pull-ups',{aliases:['Neutral Grip Pull-ups','Leuanveto neutraalilla otteella'],category:'pull',movementTags:['vertical_pull'],equipmentTags:['pullup_bar','bodyweight'],primaryMuscles:['lats','upper_back'],secondaryMuscles:['biceps','rear_delts'],popularity:28}),
  exerciseEntry('Assisted Chin-ups',{aliases:['Avustettu leuanveto'],category:'pull',movementTags:['vertical_pull'],equipmentTags:['pullup_bar','bodyweight','machine'],primaryMuscles:['lats','upper_back'],secondaryMuscles:['biceps','rear_delts'],popularity:18}),
  exerciseEntry('Pull-downs',{aliases:['Lat Pulldowns','Lat Pulldown','Lat Pull-down','Lat Pull-down (Wide Grip)','Lat Pull-down (Close Grip)','Lat Pulldown (Wide Grip)','Lat Pulldown (Close Grip)','Alasvedot'],category:'pull',movementTags:['vertical_pull'],equipmentTags:['cable'],primaryMuscles:['lats','upper_back'],secondaryMuscles:['biceps','rear_delts'],featured:true,popularity:44}),
  exerciseEntry('Weighted Planks',{aliases:['Painollinen lankku'],category:'core',movementTags:['core'],equipmentTags:['bodyweight'],primaryMuscles:['core','abs'],secondaryMuscles:['obliques'],featured:true,popularity:26}),
  exerciseEntry('Pallof Press',{aliases:['Pallof-punnerrus'],category:'core',movementTags:['core'],equipmentTags:['cable','band'],primaryMuscles:['obliques','core'],secondaryMuscles:['shoulders'],popularity:18}),
  exerciseEntry('Ab Wheel Rollouts',{aliases:['Ab Wheel','Vatsapyörä'],category:'core',movementTags:['core'],equipmentTags:['bodyweight'],primaryMuscles:['abs','core'],secondaryMuscles:['lats','shoulders'],featured:true,popularity:24}),
  exerciseEntry('Hanging Leg Raises',{aliases:['Roikkuvat jalkojen nostot'],category:'core',movementTags:['core'],equipmentTags:['pullup_bar','bodyweight'],primaryMuscles:['abs','core'],secondaryMuscles:['obliques','hip_flexors'],popularity:20}),
  exerciseEntry('Cable Crunches',{aliases:['Kaapelirutistus'],category:'core',movementTags:['core'],equipmentTags:['cable'],primaryMuscles:['abs','core'],secondaryMuscles:['obliques'],popularity:18}),
  exerciseEntry('Dead Bugs',{aliases:['Dead bug'],category:'core',movementTags:['core'],equipmentTags:['bodyweight'],primaryMuscles:['core','abs'],secondaryMuscles:['obliques'],popularity:16}),
  exerciseEntry('Dumbbell Bicep Curls',{aliases:['Hauiskääntö käsipainoilla'],category:'isolation',movementTags:['isolation'],equipmentTags:['dumbbell'],primaryMuscles:['biceps'],secondaryMuscles:['forearms'],popularity:20}),
  exerciseEntry('Dumbbell Lateral Raises',{aliases:['Käsipainosivunosto'],category:'isolation',movementTags:['isolation'],equipmentTags:['dumbbell'],primaryMuscles:['side_delts'],secondaryMuscles:['upper_traps'],popularity:20}),
  exerciseEntry('Overhead Triceps Extensions',{aliases:['Ojentajapunnerrus pään yli'],category:'isolation',movementTags:['isolation'],equipmentTags:['dumbbell','cable'],primaryMuscles:['triceps'],secondaryMuscles:[],popularity:16})
];

const EXERCISE_METADATA_OVERRIDES={
  'bench press':{movementTags:['horizontal_press'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[]},
  'barbell bench press':{movementTags:['horizontal_press'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[]},
  'barbell row':{movementTags:['horizontal_pull'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts']},
  'barbell rows':{movementTags:['horizontal_pull'],primaryMuscles:['upper_back','lats'],secondaryMuscles:['biceps','rear_delts']},
  'deadlift':{movementTags:['hinge'],primaryMuscles:['hamstrings','glutes','lower_back'],secondaryMuscles:['upper_back','core','grip']},
  'sumo deadlift':{movementTags:['hinge'],primaryMuscles:['glutes','adductors','quads'],secondaryMuscles:['hamstrings','core']},
  'front squat':{movementTags:['squat'],primaryMuscles:['quads','glutes'],secondaryMuscles:['upper_back','core']},
  'ohp':{movementTags:['vertical_press'],primaryMuscles:['front_delts','triceps'],secondaryMuscles:['upper_chest','core']},
  'overhead press (ohp)':{movementTags:['vertical_press'],primaryMuscles:['front_delts','triceps'],secondaryMuscles:['upper_chest','core']},
  'push press':{movementTags:['vertical_press'],primaryMuscles:['front_delts','triceps'],secondaryMuscles:['quads','glutes','core']},
  'weighted planks':{movementTags:['core'],primaryMuscles:['core','abs'],secondaryMuscles:['obliques']},
  'ab wheel rollouts':{movementTags:['core'],primaryMuscles:['abs','core'],secondaryMuscles:['lats','shoulders']},
  'dips':{movementTags:['vertical_press'],primaryMuscles:['chest','triceps'],secondaryMuscles:['front_delts']},
  'bodyweight squats':{category:'squat',movementTags:['squat'],equipmentTags:['bodyweight'],primaryMuscles:['quads','glutes'],secondaryMuscles:['hamstrings','core']},
  'close-grip push-ups':{category:'press',movementTags:['horizontal_press'],equipmentTags:['bodyweight'],primaryMuscles:['chest','triceps'],secondaryMuscles:['front_delts','core']},
  'band pull-aparts':{category:'pull',movementTags:['horizontal_pull','isolation'],equipmentTags:['band'],primaryMuscles:['rear_delts','upper_back'],secondaryMuscles:['shoulders']},
  'dead hangs':{category:'pull',movementTags:['vertical_pull'],equipmentTags:['pullup_bar','bodyweight'],primaryMuscles:['grip','lats'],secondaryMuscles:['shoulders']},
  'skull crushers':{category:'isolation',movementTags:['isolation'],equipmentTags:['barbell','dumbbell'],primaryMuscles:['triceps'],secondaryMuscles:[]},
  'cable triceps pressdowns':{category:'isolation',movementTags:['isolation'],equipmentTags:['cable'],primaryMuscles:['triceps'],secondaryMuscles:[]},
  'ab crunches':{category:'core',movementTags:['core'],equipmentTags:['bodyweight'],primaryMuscles:['abs','core'],secondaryMuscles:['obliques']},
  'lat pulldown (wide grip)':{category:'pull',movementTags:['vertical_pull'],equipmentTags:['cable'],primaryMuscles:['lats','upper_back'],secondaryMuscles:['biceps','rear_delts']},
  'lat pulldown (close grip)':{category:'pull',movementTags:['vertical_pull'],equipmentTags:['cable'],primaryMuscles:['lats','upper_back'],secondaryMuscles:['biceps','rear_delts']},
  'barbell romanian deadlift':{category:'hinge',movementTags:['hinge'],equipmentTags:['barbell'],primaryMuscles:['hamstrings','glutes'],secondaryMuscles:['lower_back','core']},
  'dumbbell romanian deadlift':{category:'hinge',movementTags:['hinge'],equipmentTags:['dumbbell'],primaryMuscles:['hamstrings','glutes'],secondaryMuscles:['lower_back','core']},
  'dumbbell glute bridges':{category:'hinge',movementTags:['hinge'],equipmentTags:['dumbbell'],primaryMuscles:['glutes','hamstrings'],secondaryMuscles:['core']},
  'long pause bench':{category:'press',movementTags:['horizontal_press'],equipmentTags:['barbell'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[]},
  'spoto press':{category:'press',movementTags:['horizontal_press'],equipmentTags:['barbell'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[]},
  'wider grip bench':{category:'press',movementTags:['horizontal_press'],equipmentTags:['barbell'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[]},
  'slingshot bench':{category:'press',movementTags:['horizontal_press'],equipmentTags:['barbell'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[]},
  'bench with feet up':{category:'press',movementTags:['horizontal_press'],equipmentTags:['barbell'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[]},
  'bench with slow eccentric':{category:'press',movementTags:['horizontal_press'],equipmentTags:['barbell'],primaryMuscles:['chest','front_delts','triceps'],secondaryMuscles:[]},
  'block pull':{category:'hinge',movementTags:['hinge'],equipmentTags:['barbell'],primaryMuscles:['hamstrings','glutes','lower_back'],secondaryMuscles:['upper_back','core']},
  'rack pull':{category:'hinge',movementTags:['hinge'],equipmentTags:['barbell'],primaryMuscles:['hamstrings','glutes','lower_back'],secondaryMuscles:['upper_back','core']},
  'behind the neck ohp':{category:'press',movementTags:['vertical_press'],equipmentTags:['barbell'],primaryMuscles:['front_delts','triceps'],secondaryMuscles:['upper_back','core']},
  'seated ohp':{category:'press',movementTags:['vertical_press'],equipmentTags:['barbell'],primaryMuscles:['front_delts','triceps'],secondaryMuscles:['upper_chest','core']}
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

function guidancePack(en,fi){
  return{
    en:{description:en.description||'',setup:en.setup||'',execution:en.execution||[],cues:en.cues||[],safety:en.safety||'',media:en.media||{}},
    fi:{description:fi.description||'',setup:fi.setup||'',execution:fi.execution||[],cues:fi.cues||[],safety:fi.safety||'',media:fi.media||{}}
  };
}

function matchesGuidanceName(name,names){
  return names.includes(name);
}

function getSpecificGuidance(name,localizedNameEn,localizedNameFi){
  const n=normalize(name);
  if(matchesGuidanceName(n,['squat','back squat','barbell back squat'])){
    return guidancePack(
      {
        description:localizedNameEn+' is the main lower-body strength lift in most barbell programs. It builds quads, glutes, and bracing skill and teaches you to stay balanced under load.',
        setup:'Set the bar across the upper back, place feet about shoulder width, screw the feet into the floor, and take a full brace before you unlock the knees.',
        execution:[
          'Break at knees and hips together so the bar stays over mid-foot.',
          'Sit down between the legs while keeping chest and hips rising and falling together.',
          'Drive the floor away and stand up without letting the bar drift forward.'
        ],
        cues:['Brace hard before the descent.','Keep the whole foot planted.','Push up with hips and chest together.'],
        safety:'If the heels lift, knees cave hard, or your lower back rounds, reduce load and shorten the range to what you can control.'
      },
      {
        description:localizedNameFi+' on useimpien voimaharjoitusohjelmien tärkein alavartalon perusliike. Se kehittää etureisiä, pakaroita ja keskivartalon tukea sekä opettaa pysymään tasapainossa kuorman alla.',
        setup:'Aseta tanko yläselälle, ota noin hartialeveä asento, ruuvaa jalat lattiaan ja vedä iso tuki ennen kuin avaat polvet.',
        execution:[
          'Aloita liike polvista ja lantiosta yhtä aikaa, jotta tanko pysyy keskijalan päällä.',
          'Laskeudu jalkojen väliin niin, että rinta ja lantio liikkuvat samaa tahtia.',
          'Punnerra lattiaa pois alta ja nouse ylös ilman että tanko karkaa eteen.'
        ],
        cues:['Ota kova tuki ennen laskua.','Pidä koko jalkapohja maassa.','Nouse lantio ja rinta samaan aikaan.'],
        safety:'Jos kantapäät irtoavat, polvet kaatuvat voimakkaasti sisään tai alaselkä pyöristyy, kevennä kuormaa ja lyhennä liikettä hallittavaan syvyyteen.'
      }
    );
  }

  if(n==='front squat'){
    return guidancePack(
      {
        description:localizedNameEn+' is a quad-dominant squat variation used to build upright posture, upper-back strength, and clean bar path for athletes who fold forward in the back squat.',
        setup:'Rack the bar on the front delts, lift elbows high, keep hands relaxed around the bar, and stand with feet in your normal squat stance.',
        execution:[
          'Brace before each rep and let the knees travel forward so you can stay upright.',
          'Descend under control while keeping elbows up and chest tall.',
          'Drive straight up and keep the bar glued to the shoulders through the whole rep.'
        ],
        cues:['Elbows high.','Stay tall through the chest.','Push the floor away, not the hips back.'],
        safety:'If the elbows drop and the bar rolls forward, reduce the load and rebuild the rack position before adding weight.'
      },
      {
        description:localizedNameFi+' on etureisipainotteinen kyykkyvariaatio, jolla kehitetään pystympää asentoa, yläselän voimaa ja siistiä tankolinjaa erityisesti silloin kun takakyykky kaatuu eteen.',
        setup:'Aseta tanko etuolkapäille, nosta kyynärpäät korkealle, pidä ote rentona tangon ympärillä ja seiso normaalissa kyykkyasennossasi.',
        execution:[
          'Tue ennen jokaista toistoa ja anna polvien liikkua eteen, jotta vartalo pysyy pystyssä.',
          'Laskeudu hallitusti pitäen kyynärpäät ylhäällä ja rinta korkealla.',
          'Nouse suoraan ylös ja pidä tanko koko ajan etuolkapäillä.'
        ],
        cues:['Kyynärpäät ylös.','Rinta korkealla.','Punnerra suoraan ylöspäin.'],
        safety:'Jos kyynärpäät putoavat ja tanko valuu eteen, kevennä kuormaa ja korjaa eturäkkiasento ennen kuin lisäät painoa.'
      }
    );
  }

  if(n==='paused squat'){
    return guidancePack(
      {
        description:localizedNameEn+' is a squat variation for position control and starting strength out of the bottom. It is useful when the normal squat turns into a bounce-and-hope rep.',
        setup:'Use your normal squat setup, then decide in advance where the pause happens so every rep stops at the same depth.',
        execution:[
          'Descend with control and stop in the bottom without relaxing into the joints.',
          'Hold the brace and keep the feet rooted during the pause.',
          'Drive up from the paused position without rebounding.'
        ],
        cues:['Pause with tension, not by collapsing.','Keep the brace during the hold.','Drive straight up from the hole.'],
        safety:'If the pause makes you lose spinal position or cave inward, shorten the pause or reduce load.'
      },
      {
        description:localizedNameFi+' on kyykkyvariaatio asennonhallintaan ja pohjasta lähtevään voimaan. Se auttaa erityisesti silloin, kun tavallinen kyykky muuttuu pomppimiseksi ilman hallintaa.',
        setup:'Käytä normaalia kyykkyasetustasi ja päätä etukäteen pysäytyksen kohta, jotta jokainen toisto pysähtyy samaan syvyyteen.',
        execution:[
          'Laskeudu hallitusti ja pysäytä liike pohjaan ilman että rojahdat nivelten varaan.',
          'Pidä tuki ja koko jalkapohja maassa pysäytyksen ajan.',
          'Nouse ylös pysäytyksestä ilman pomppua.'
        ],
        cues:['Pysähdy jännityksellä, älä lysähdä.','Pidä tuki koko pysäytyksen ajan.','Punnerra suoraan ylös pohjasta.'],
        safety:'Jos pysäytys vie selän pois asennosta tai polvet painuvat sisään, lyhennä pysäytystä tai kevennä kuormaa.'
      }
    );
  }

  if(matchesGuidanceName(n,['high bar squat','beltless squat','wider stance squat','narrower stance squat','box squat','pin squat','half squat','squat with slow eccentric','bodyweight squats'])){
    const isHighBar=n==='high bar squat';
    const isBeltless=n==='beltless squat';
    const isWide=n==='wider stance squat';
    const isNarrow=n==='narrower stance squat';
    const isBox=n==='box squat';
    const isPin=n==='pin squat';
    const isHalf=n==='half squat';
    const isSlow=n==='squat with slow eccentric';
    const isBW=n==='bodyweight squats';
    return guidancePack(
      {
        description:isHighBar
          ? localizedNameEn+' keeps the bar slightly higher on the back so you can stay more upright and bias quads more than a low-bar style.'
          : isBeltless
            ? localizedNameEn+' is used to build raw bracing strength when you want to squat without relying on a belt.'
            : isWide
              ? localizedNameEn+' widens the stance to bias glutes and adductors and to find a more comfortable hip position.'
              : isNarrow
                ? localizedNameEn+' narrows the stance to bias quads and teach control through a longer knee-dominant range.'
                : isBox
                  ? localizedNameEn+' teaches you to sit back with control and use a clear depth target without crashing into the box.'
                  : isPin
                    ? localizedNameEn+' starts or reverses the squat from the pins to build starting strength and confidence in a fixed position.'
                    : isHalf
                      ? localizedNameEn+' overloads the top half of the squat and is best used as a supplementary variation, not as a replacement for full-depth squatting.'
                      : isSlow
                        ? localizedNameEn+' slows the lowering phase so you learn balance, control, and tightness instead of diving into the bottom.'
                        : localizedNameEn+' is a simple teaching version of the squat used to rehearse stance, depth, and balance before heavier loading.',
        setup:isBox
          ? 'Set the box height so you can reach it without folding over, and stand so you still squat down instead of simply sitting back behind the feet.'
          : isPin
            ? 'Set the pins to the exact depth you want to train, step under the bar carefully, and create full-body tension before the first drive.'
            : isBW
              ? 'Stand in your normal squat stance with arms forward for balance if needed, and keep the torso tall before you start descending.'
              : 'Use a stance that matches the goal of the variation, root the feet, and brace before every rep.',
        execution:isBox
          ? ['Descend under control until you lightly touch or settle onto the box without crashing.', 'Keep the trunk tight while you pause briefly on the box.', 'Drive up by pushing through the full foot and re-accelerating the bar.']
          : isPin
            ? ['Start from a dead stop with the bar over mid-foot and the trunk already braced.', 'Drive evenly through both feet so the hips do not shoot up first.', 'Stand tall and reset completely before the next rep.']
            : isHalf
              ? ['Use the same squat mechanics as a full squat, but stop at the planned partial depth every rep.', 'Keep the bar stacked over mid-foot and stay patient on the way down.', 'Stand up hard without turning the rep into a knee-only quarter squat.']
              : isSlow
                ? ['Count a smooth controlled lowering phase instead of dropping into the bottom.', 'Stay balanced over mid-foot while the knees and hips keep moving together.', 'Reverse the rep under control and stand up without losing the brace.']
                : ['Descend with the variation-specific position you are trying to train.', 'Stay balanced and keep tension through the bottom instead of chasing range you cannot control.', 'Drive up with the same bar path and balance you used on the way down.'],
        cues:isBW
          ? ['Reach the hips and knees together.','Keep the chest proud.','Stand by pushing the floor away.']
          : ['Use the stance the variation asks for.','Keep pressure through the full foot.','Stay tight in the exact position you are practicing.'],
        safety:isBox
          ? 'Do not crash onto the box or rock backward to create momentum. If that happens, reduce the load and control the descent.'
          : isPin
            ? 'If the first inch off the pins changes your back angle immediately, the setup is too loose or the load is too heavy.'
            : isHalf
              ? 'Do not mistake shorter range for sloppy range. Keep depth consistent, or the variation stops teaching anything useful.'
              : isBW
                ? 'If balance is poor or the heels lift, slow down and use a smaller range until you can keep the whole foot planted.'
                : 'If the variation changes your position so much that you lose balance or spinal control, reduce load and rebuild the pattern.'
      },
      {
        description:isHighBar
          ? localizedNameFi+' pitää tangon hieman ylempänä selällä, jolloin vartalo pysyy pystympänä ja etureidet tekevät enemmän töitä kuin matalammassa tankoasennossa.'
          : isBeltless
            ? localizedNameFi+' kehittää raakaa keskivartalon tukea silloin, kun haluat kyykätä ilman vyön apua.'
            : isWide
              ? localizedNameFi+' leventää asentoa, jolloin pakarat ja lähentäjät tekevät enemmän töitä ja lantio löytää usein mukavamman linjan.'
              : isNarrow
                ? localizedNameFi+' kaventaa asentoa, jolloin etureisien kuorma kasvaa ja polvidominanttia liikettä tulee enemmän.'
                : isBox
                  ? localizedNameFi+' opettaa istumaan taakse hallitusti ja käyttämään selkeää syvyysmerkkiä ilman että rojahdat laatikolle.'
                  : isPin
                    ? localizedNameFi+' lähtee tapeilta tai vaihtaa suunnan tappien päältä, jolloin pohjasta lähtevä voima ja asennon varmuus kehittyvät.'
                    : isHalf
                      ? localizedNameFi+' kuormittaa kyykyn yläpuoliskoa ja toimii lisävariaationa, ei täyssyvän kyykyn korvaajana.'
                      : isSlow
                        ? localizedNameFi+' hidastaa laskuvaihetta, jotta opit tasapainon, hallinnan ja tiukan asennon etkä vain putoa pohjaan.'
                        : localizedNameFi+' on yksinkertainen opetusversio kyykystä, jolla harjoitellaan asentoa, syvyyttä ja tasapainoa ennen raskaampaa kuormaa.',
        setup:isBox
          ? 'Aseta laatikko korkeuteen, johon pääset ilman että taitut eteen, ja seiso niin että joudut edelleen kyykkäämään alas etkä vain istu jalkojen taakse.'
          : isPin
            ? 'Aseta tapit täsmälleen siihen syvyyteen mitä haluat harjoitella, mene tangon alle huolellisesti ja luo koko vartalon jännitys ennen ensimmäistä työntöä.'
            : isBW
              ? 'Seiso normaalissa kyykkyasennossasi, vie kädet tarvittaessa eteen tasapainon tueksi ja pidä vartalo ryhdikkäänä ennen laskua.'
              : 'Käytä variaation tavoitetta vastaavaa asentoa, juurruta jalat lattiaan ja ota tuki ennen jokaista toistoa.',
        execution:isBox
          ? ['Laskeudu hallitusti, kunnes kosketat tai asetut laatikolle kevyesti ilman rysäystä.', 'Pidä vartalo tiukkana lyhyen pysäytyksen ajan.', 'Punnerra ylös koko jalkapohjan kautta ja kiihdytä tanko uudelleen liikkeelle.']
          : isPin
            ? ['Aloita kuolleesta pysähdyksestä niin, että tanko on keskijalan päällä ja vartalo jo valmiiksi tuettu.', 'Työnnä tasaisesti molemmilla jaloilla, jotta lantio ei karkaa ensin ylös.', 'Nouse loppuun asti ja rakenna aloitusasento uudelleen ennen seuraavaa toistoa.']
            : isHalf
              ? ['Käytä samaa kyykkytekniikkaa kuin täydessä kyykyssä, mutta pysähdy joka toistolla ennalta päätettyyn osasyvyyteen.', 'Pidä tanko keskijalan päällä ja laskeudu kärsivällisesti.', 'Nouse voimakkaasti ylös muuttamatta liikettä polvipainotteiseksi nykäisyksi.']
              : isSlow
                ? ['Laskeudu tasaisella, hitaalla laskulla sen sijaan että putoaisit pohjaan.', 'Pidä tasapaino keskijalalla samalla kun polvet ja lantio liikkuvat yhdessä.', 'Vaihda suunta hallitusti ja nouse ylös ilman että tuki katoaa.']
                : ['Laskeudu variaation tavoittelemaan asentoon hallitusti.', 'Säilytä jännitys pohjassa äläkä hae syvyyttä, jota et pysty hallitsemaan.', 'Nouse ylös samalla tankolinjalla ja tasapainolla kuin laskit alas.'],
        cues:isBW
          ? ['Aloita polvista ja lantiosta yhdessä.','Pidä rinta ylpeänä.','Nouse punnertamalla lattiaa.']
          : ['Käytä variaation vaatimaa asentoa.','Pidä paine koko jalkapohjalla.','Pysy tiukkana juuri siinä asennossa jota harjoittelet.'],
        safety:isBox
          ? 'Älä rysäytä laatikolle tai keinu taakse vauhtia hakiaksesi. Jos näin käy, kevennä painoa ja hallitse lasku.'
          : isPin
            ? 'Jos ensimmäinen sentti tappien päältä muuttaa selän kulman heti, aloitusasento on löysä tai kuorma liian raskas.'
            : isHalf
              ? 'Älä sekoita lyhyempää liikerataa huolimattomaan liikerataan. Syvyyden pitää pysyä samana joka toistolla.'
              : isBW
                ? 'Jos tasapaino karkaa tai kantapäät irtoavat, hidasta tahtia ja käytä pienempää liikelaajuutta kunnes koko jalkapohja pysyy maassa.'
                : 'Jos variaatio vie sinut asentoon, jossa tasapaino tai selän hallinta katoaa, kevennä kuormaa ja rakenna liike uudelleen.'
      }
    );
  }

  if(matchesGuidanceName(n,['leg press','bulgarian split squats','walking lunges','reverse lunges','step-ups'])){
    const isLegPress=n==='leg press';
    const isStepUps=n==='step-ups';
    return guidancePack(
      {
        description:isLegPress
          ? localizedNameEn+' is a stable quad-focused lower-body movement used when you want hard leg work without the full balance demands of a barbell squat.'
          : localizedNameEn+' builds single-leg strength, balance, and hip control and is useful when you want lower-body work that also exposes left-right differences.',
        setup:isLegPress
          ? 'Set the seat so your lower back stays flat on the pad, place feet in the middle of the platform, and unlock the sled before you start descending.'
          : isStepUps
            ? 'Choose a box height that lets you step up without jumping off the back leg, and place the full working foot on the box.'
            : 'Set up so you can keep pressure on the front foot, stay tall, and control balance before starting each rep.',
        execution:isLegPress
          ? ['Lower the sled until the knees and hips are bent as far as you can control without the lower back lifting.', 'Keep the whole foot on the platform and the knees tracking in line with the toes.', 'Press the sled away by driving through mid-foot and heel.']
          : isStepUps
            ? ['Lean slightly into the working leg and push through the foot already on the box.', 'Stand fully on top using the lead leg instead of bouncing off the trailing foot.', 'Lower back down under control and repeat on the same side or alternate as planned.']
            : ['Lower under control so the front leg stays loaded and balanced.', 'Keep the torso stacked over the hips instead of diving forward.', 'Drive through the front foot to return to the start.'],
        cues:isLegPress
          ? ['Keep your low back on the pad.','Push through the full foot.','Do not lock the knees aggressively.']
          : ['Front foot does the work.','Stay tall through the torso.','Control the lowering phase.'],
        safety:isLegPress
          ? 'If the pelvis rolls off the pad at the bottom, your range is too deep for your current setup. Shorten the descent and keep the low back planted.'
          : isStepUps
            ? 'If you must jump off the trailing leg to get up, the box is too high or the load is too heavy.'
            : 'If balance disappears or the front knee caves sharply inward, reduce load and slow the rep down.'
      },
      {
        description:isLegPress
          ? localizedNameFi+' on vakaa, etureisipainotteinen jalkaliike silloin kun haluat kovaa jalkatyötä ilman tangollisen kyykyn täyttä tasapainovaatimusta.'
          : localizedNameFi+' kehittää yhden jalan voimaa, tasapainoa ja lantion hallintaa ja paljastaa samalla puolieroja.',
        setup:isLegPress
          ? 'Säädä istuin niin, että alaselkä pysyy kiinni selkänojassa, aseta jalat lautan keskiosaan ja avaa kelkka hallitusti ennen laskua.'
          : isStepUps
            ? 'Valitse korokkeen korkeus, jolle pääset ilman että pomppaat takajalalla, ja aseta koko työjalka korokkeelle.'
            : 'Asetu niin, että saat pidettyä paineen etujalalla, vartalon ryhdikkäänä ja tasapainon hallinnassa ennen jokaista toistoa.',
        execution:isLegPress
          ? ['Laske kelkkaa niin alas kuin pystyt hallitsemaan ilman että alaselkä irtoaa tuesta.', 'Pidä koko jalkapohja laudan päällä ja polvet samassa linjassa varpaiden kanssa.', 'Punnerra kelkka pois keskijalan ja kantapään kautta.']
          : isStepUps
            ? ['Nojaa kevyesti työjalan päälle ja työnnä korokkeella olevan jalan kautta.', 'Nouse kokonaan korokkeen päälle työjalan avulla ilman että pomppaat takajalalla.', 'Laskeudu alas hallitusti ja toista samalla puolella tai vuorotellen suunnitelman mukaan.']
            : ['Laskeudu hallitusti niin, että etujalka pysyy kuormitettuna ja tasapainossa.', 'Pidä vartalo lantion päällä äläkä sukella eteen.', 'Punnerra etujalan kautta takaisin alkuasentoon.'],
        cues:isLegPress
          ? ['Pidä alaselkä tuessa.','Punnerra koko jalkapohjalla.','Älä lukitse polvia aggressiivisesti.']
          : ['Etujalka tekee työn.','Pidä vartalo ryhdikkäänä.','Hallitse laskuvaihe.'],
        safety:isLegPress
          ? 'Jos lantio pyörähtää irti tuesta ala-asennossa, liikelaajuus on liian suuri nykyiselle liikkuvuudelle tai asetukselle. Lyhennä laskua.'
          : isStepUps
            ? 'Jos joudut pomppaamaan takajalalla ylös, koroke on liian korkea tai kuorma liian suuri.'
            : 'Jos tasapaino katoaa tai etupolvi romahtaa voimakkaasti sisään, kevennä kuormaa ja hidasta toistoa.'
      }
    );
  }

  if(matchesGuidanceName(n,['bench press','close-grip bench','incline press','db bench','db incline press','machine chest press','push-ups','close-grip push-ups','dips','long pause bench','spoto press','wider grip bench','board press','pin press','slingshot bench','bench with feet up','bench with slow eccentric'])){
    const isPushups=n==='push-ups'||n==='close-grip push-ups';
    const isDips=n==='dips';
    const isPauseBench=n==='long pause bench'||n==='spoto press'||n==='board press'||n==='pin press';
    return guidancePack(
      {
        description:isPushups
          ? localizedNameEn+' is a bodyweight press used to build pressing coordination and repeatable upper-body volume.'
          : isDips
            ? localizedNameEn+' trains chest, triceps, and shoulder extension strength and is usually used as a hard bodyweight or weighted accessory press.'
            : localizedNameEn+' is a horizontal pressing variation used to build chest, triceps, and stable shoulder mechanics or to solve a specific bench weakness.',
        setup:isPushups
          ? 'Set the hands under the shoulders or slightly inside for close-grip work, straighten the body from head to heel, and brace the trunk before the first rep.'
          : isDips
            ? 'Start on stable bars with elbows locked, shoulders set down, and the ribcage stacked over the hands.'
            : 'Set the upper back first, pull the shoulder blades into the bench or pad, place hands evenly, and create a stable touch point before you unrack.',
        execution:isPushups
          ? ['Lower the whole body as one unit until the chest is close to the floor.', 'Keep elbows tracking in a position you can control instead of flaring wildly.', 'Press the floor away and finish with the body still in a straight line.']
          : isDips
            ? ['Lower by bending the elbows while keeping the shoulders packed and the chest slightly forward.', 'Descend only as far as you can keep the shoulders stable.', 'Drive back up by pressing through the bars until the elbows lock out.']
            : isPauseBench
              ? ['Lower the bar under full control to the same bottom position every rep.', 'Stay tight in the pause or shortened-range position instead of bouncing through it.', 'Press back up on a controlled bar path with the shoulders still packed.']
              : ['Lower with control to a consistent bottom position or touch point.', 'Keep forearms stacked so force travels cleanly into the bar or handles.', 'Press to lockout while keeping the ribcage and shoulders stable.'],
        cues:isPushups
          ? ['Body stays in one line.','Screw hands into the floor.','Press away hard at the top.']
          : isDips
            ? ['Shoulders down and away from ears.','Control the bottom.','Press through full lockout.']
            : ['Same touch point every rep.','Wrists over elbows.','Keep the upper back tight.'],
        safety:isDips
          ? 'Do not chase extreme depth if it forces the shoulders to roll forward. Only lower as far as you can stay packed.'
          : isPushups
            ? 'If the hips sag or the head reaches the floor before the chest, elevate the hands or cut the set before form breaks.'
            : 'If the bar path wanders, the shoulders slide out of position, or the chest touch becomes inconsistent, reduce load and rebuild control.'
      },
      {
        description:isPushups
          ? localizedNameFi+' on kehonpainopunnerrus, jolla rakennetaan punnerruskoordinaatiota ja toistettavaa ylävartalon volyymia.'
          : isDips
            ? localizedNameFi+' kuormittaa rintaa, ojentajia ja olkanivelen ojennusta ja toimii usein kovana kehonpaino- tai lisäpainopunnerruksena.'
            : localizedNameFi+' on vaakapunnerruksen variaatio, jolla rakennetaan rintaa, ojentajia ja vakaata olkapään hallintaa tai korjataan tiettyä penkkipunnerruksen heikkoutta.',
        setup:isPushups
          ? 'Aseta kädet olkapäiden alle tai hieman sisemmäs kapeaa versiota varten, suorista vartalo päästä kantapäihin ja tue keskivartalo ennen ensimmäistä toistoa.'
          : isDips
            ? 'Aloita vakailla tankeilla kyynärpäät ojennettuina, vedä hartiat alas ja pidä rintakehä käsien päällä.'
            : 'Rakenna ensin yläselän asento, vedä lapaluut penkkiä tai tukea vasten, ota tasainen ote ja päätä vakio kosketuspiste ennen nostoa.',
        execution:isPushups
          ? ['Laske koko vartalo yhtenä pakettina niin, että rinta lähestyy lattiaa.', 'Pidä kyynärpäät hallitussa linjassa äläkä levitä niitä hallitsemattomasti.', 'Punnerra lattia pois ja lopeta suoraan vartalolinjaan.']
          : isDips
            ? ['Laskeudu koukistamalla kyynärpäitä samalla kun hartiat pysyvät alhaalla ja rinta hieman eteen suunnattuna.', 'Laske vain niin alas kuin pystyt pitämään olkapäät hallinnassa.', 'Punnerra takaisin ylös, kunnes kyynärpäät lukittuvat.']
            : isPauseBench
              ? ['Laske tanko täysin hallitusti samaan ala-asentoon joka toistolla.', 'Pysy tiukkana pysäytyksessä tai lyhennetyssä liikeradassa äläkä pomputa läpi.', 'Punnerra takaisin ylös hallittua tankolinjaa pitkin niin, että olkapäät pysyvät paikoillaan.']
              : ['Laske hallitusti samaan ala-asentoon tai kosketuspisteeseen joka toistolla.', 'Pidä kyynärvarret pinottuna niin, että voima siirtyy puhtaasti tankoon tai kahvoihin.', 'Punnerra ylös loppuun asti pitäen rintakehä ja olkapäät hallinnassa.'],
        cues:isPushups
          ? ['Vartalo yhtenä linjana.','Ruuvaa kädet lattiaan.','Punnerra lopussa voimakkaasti.']
          : isDips
            ? ['Hartiat alas pois korvista.','Hallitse pohja.','Punnerra täyteen lukitukseen.']
            : ['Sama kosketuspiste joka toistolla.','Ranteet kyynärpäiden päällä.','Pidä yläselkä tiukkana.'],
        safety:isDips
          ? 'Älä hae äärisyvyyttä, jos se pakottaa olkapäät kiertymään eteen. Mene vain niin alas kuin hallitset.'
          : isPushups
            ? 'Jos lantio notkahtaa tai pää osuu lattiaan ennen rintaa, korota käsiä tai lopeta sarja ennen tekniikan hajoamista.'
            : 'Jos tankolinja vaeltelee, olkapäät liukuvat pois asennosta tai kosketuspiste vaihtelee, kevennä kuormaa ja rakenna hallinta uudelleen.'
      }
    );
  }

  if(matchesGuidanceName(n,['deadlift','conventional deadlift','sumo deadlift','romanian deadlift','barbell romanian deadlift','dumbbell romanian deadlift','trap bar deadlift','block pull','rack pull','deficit deadlift','stiff leg deadlift','snatch grip deadlift','good morning','back extensions','45deg hip extensions','hamstring curls','dumbbell glute bridges'])){
    const isHamCurl=n==='hamstring curls';
    const isGoodMorning=n==='good morning';
    const isBackExt=n==='back extensions'||n==='45deg hip extensions';
    const isRDL=matchesGuidanceName(n,['romanian deadlift','barbell romanian deadlift','dumbbell romanian deadlift']);
    const isGluteBridge=n==='dumbbell glute bridges';
    return guidancePack(
      {
        description:isHamCurl
          ? localizedNameEn+' isolates knee flexion and adds direct hamstring volume without loading the spine heavily.'
          : isGoodMorning
            ? localizedNameEn+' is a loaded hinge used to build posterior-chain strength and teach you to keep the torso rigid while the hips move back.'
            : isBackExt
              ? localizedNameEn+' is a controlled posterior-chain builder that lets you train hip extension without the setup demands of a barbell pull.'
              : isRDL
                ? localizedNameEn+' is a hinge-focused assistance lift used to load hamstrings and glutes through a long eccentric with less knee bend than a deadlift.'
                : isGluteBridge
                  ? localizedNameEn+' is a glute-focused hinge assistance lift that teaches you to finish hip extension without overextending the low back.'
                  : localizedNameEn+' trains forceful hip extension, trunk rigidity, and a clean pull close to the body.',
        setup:isHamCurl
          ? 'Adjust the machine so the knee lines up with the pivot point and the pad sits securely against the lower leg before you start.'
          : isGluteBridge
            ? 'Sit close enough to the bench or floor setup that the dumbbell stays stable on the hips and your shins can become nearly vertical at the top.'
            : isBackExt
              ? 'Set the pad so you can hinge at the hips rather than bending through the low back, and brace before each rep.'
              : isGoodMorning
                ? 'Place the bar securely on the upper back, unlock the knees slightly, and brace as if you were about to squat.'
                : 'Stand or set up with the load over mid-foot, lock in the lats, and build trunk tension before the weight leaves the floor or starts moving.',
        execution:isHamCurl
          ? ['Curl the pad by pulling the heels toward the hips without lifting the pelvis off the bench.', 'Pause briefly when the hamstrings are shortened hard.', 'Lower with control until the knees are almost straight again.']
          : isGluteBridge
            ? ['Drive through the heels and squeeze the glutes to lift the hips.', 'Finish with ribs down so the movement ends in hip extension, not low-back arching.', 'Lower back under control and repeat.']
            : isBackExt
              ? ['Hinge down by folding at the hips while keeping the torso long.', 'Reverse the rep by squeezing glutes and hamstrings, not by whipping the low back.', 'Finish in a straight line from head to knee without leaning past neutral.']
              : isGoodMorning
                ? ['Push the hips back while keeping a soft knee bend and the torso rigid.', 'Lower only as far as you can keep the spine neutral and the bar fixed on the back.', 'Drive the hips through to stand tall without snapping into hyperextension.']
                : isRDL
                  ? ['Unlock the knees slightly and push the hips back while the load stays close to the thighs.', 'Lower until the hamstrings are loaded as far as you can keep the spine neutral.', 'Drive the hips forward to stand tall while keeping the ribs stacked.']
                  : ['Create tension before the rep, keep the bar or handles close, and move the floor away from you.', 'Keep the trunk stiff while the hips and knees extend through the middle of the rep.', 'Finish tall without over-leaning back or losing the brace.'],
        cues:isHamCurl
          ? ['Hips stay still.','Squeeze at the top.','Lower under control.']
          : isGoodMorning
            ? ['Hips back.','Torso stays rigid.','Stand tall, do not snap back.']
            : ['Load the hamstrings.','Keep the load close.','Finish with hips, not low-back swing.'],
        safety:isHamCurl
          ? 'If you feel cramping or pelvis movement instead of hamstring work, lighten the load and slow the rep down.'
          : 'Do not chase range if it turns the movement into low-back motion. Control the hinge first, then add load.'
      },
      {
        description:isHamCurl
          ? localizedNameFi+' eristää polven koukistusta ja lisää suoraa takareisityötä ilman suurta selkärangan kuormitusta.'
          : isGoodMorning
            ? localizedNameFi+' on kuormitettu saranaliike, jolla rakennetaan takaketjun voimaa ja opetellaan pitämään vartalo jäykkänä lantion liikkuessa taakse.'
            : isBackExt
              ? localizedNameFi+' on hallittu takaketjun liike, jolla lonkan ojennusta voi harjoittaa ilman tangollisen vedon vaativaa aloitusasentoa.'
              : isRDL
                ? localizedNameFi+' on lonkkanivelen saranaliike, jolla kuormitetaan takareisiä ja pakaroita pitkän jarruttavan vaiheen läpi pienemmällä polvikulman muutoksella kuin maastavedossa.'
                : isGluteBridge
                  ? localizedNameFi+' on pakarapainotteinen saranaliike, joka opettaa viimeistelemään lonkan ojennuksen ilman alaselän yliojennusta.'
                  : localizedNameFi+' harjoittaa voimakasta lonkan ojennusta, vartalon jäykkyyttä ja siistiä, kehoa seuraavaa vetoa.',
        setup:isHamCurl
          ? 'Säädä laite niin, että polvi osuu nivelakselin linjaan ja pehmuste asettuu tukevasti säären alaosaa vasten ennen liikettä.'
          : isGluteBridge
            ? 'Asetu niin lähelle penkkiä tai lattia-asentoa, että käsipaino pysyy vakaasti lantion päällä ja sääret voivat olla lähes pystysuorassa yläasennossa.'
            : isBackExt
              ? 'Säädä tuki niin, että pääset taittumaan lonkasta etkä pelkästään alaselästä, ja ota tuki ennen jokaista toistoa.'
              : isGoodMorning
                ? 'Aseta tanko tukevasti yläselälle, avaa polvia hieman ja tue kuten olisit aloittamassa kyykkyä.'
                : 'Asetu niin, että kuorma on keskijalan päällä, lukitse kainalot alas ja rakenna keskivartalon jännitys ennen kuin paino irtoaa lattiasta tai alkaa liikkua.',
        execution:isHamCurl
          ? ['Koukista pehmustetta vetämällä kantapäitä kohti pakaroita ilman että lantio irtoaa penkistä.', 'Pidä yläasennossa lyhyt puristus takareisillä.', 'Laske hallitusti takaisin lähes suorille polville.']
          : isGluteBridge
            ? ['Punnerra kantapäiden kautta ja purista pakarat nostaaksesi lantion ylös.', 'Lopeta liike kyljet alhaalla niin, että liike päättyy lonkan ojennukseen eikä alaselän notkoon.', 'Laskeudu takaisin alas hallitusti ja toista.']
            : isBackExt
              ? ['Taita vartaloa alas lonkasta pitäen vartalo pitkänä.', 'Vaihda suunta puristamalla pakaroita ja takareisiä, älä heittämällä alaselkää.', 'Lopeta suoraksi päästä polveen ilman että nojataan neutraalin yli.']
              : isGoodMorning
                ? ['Työnnä lantiota taakse kevyellä polvikulmalla ja pidä vartalo jäykkänä.', 'Laske vain niin alas kuin pystyt säilyttämään neutraalin selän ja tangon vakaana selällä.', 'Aja lantio eteen ja nouse pystyyn ilman että napsautat itseäsi yliojennukseen.']
                : isRDL
                  ? ['Avaa polvia hieman ja vie lantiota taakse samalla kun kuorma pysyy lähellä reisiä.', 'Laske niin alas kuin pystyt pitämään selän neutraalina ja takareidet kuormitettuna.', 'Aja lantio eteen ja nouse ylös pitäen kyljet pinottuna.']
                  : ['Rakenna jännitys ennen toistoa, pidä tanko tai kahvat lähellä kehoa ja työnnä lattiaa pois alta.', 'Pidä vartalo jäykkänä samalla kun lonkka ja polvi ojentuvat vedon keskivaiheessa.', 'Lopeta pystyasentoon ilman taakse nojaamista tai tuen menetystä.'],
        cues:isHamCurl
          ? ['Lantio paikallaan.','Purista yläasennossa.','Laske hallitusti.']
          : isGoodMorning
            ? ['Lantio taakse.','Vartalo jäykkänä.','Nouse pystyyn, älä napsauta taakse.']
            : ['Lataa takareidet.','Pidä kuorma lähellä.','Viimeistele lantiolla, älä alaselällä.'],
        safety:isHamCurl
          ? 'Jos tunnet kramppeja tai lantion liikettä enemmän kuin takareisityötä, kevennä kuormaa ja hidasta toistoa.'
          : 'Älä hae lisää liikelaajuutta, jos liike muuttuu alaselän liikkeeksi. Hallitse sarana ensin, lisää kuormaa vasta sitten.'
      }
    );
  }

  if(matchesGuidanceName(n,['ohp','push press','db ohp','behind the neck ohp','seated ohp'])){
    const isPushPress=n==='push press';
    const isBTN=n==='behind the neck ohp';
    const isSeated=n==='seated ohp';
    return guidancePack(
      {
        description:isPushPress
          ? localizedNameEn+' adds a small leg drive so you can train force transfer into a heavier overhead lockout.'
          : isBTN
            ? localizedNameEn+' challenges overhead mobility and upper-back control and should only be used if your shoulders tolerate the position well.'
            : isSeated
              ? localizedNameEn+' removes leg drive and lower-body help so the shoulders and trunk must do all the stabilization work.'
              : localizedNameEn+' is a main vertical press for building shoulders, triceps, and overhead bracing strength.',
        setup:isSeated
          ? 'Sit tall with feet rooted, glutes tight, and the ribcage stacked over the pelvis before the bar leaves the shoulders.'
          : 'Start with the bar or bells at shoulder height, squeeze glutes and abs, and keep the elbows slightly in front of the load.',
        execution:isPushPress
          ? ['Dip straight down a few inches with the torso vertical.', 'Drive hard through the legs so the bar leaves the shoulders with speed.', 'Finish by pressing yourself under the bar into a stable lockout.']
          : ['Press upward while moving the head slightly back first so the load can travel in a straight line.', 'Once the load passes the forehead, push the head back through and stack it over the shoulders and hips.', 'Lower under control back to the starting rack position.'],
        cues:isPushPress
          ? ['Short vertical dip.','Legs start the bar, arms finish it.','Catch the lockout hard.']
          : ['Ribs down.','Press close to the face.','Head through at the top.'],
        safety:isBTN
          ? 'If you cannot keep the ribcage down and the shoulders pain-free in the behind-the-neck position, skip this variation.'
          : 'If the lower back arches hard to finish the rep, the load is too heavy for your current overhead control.'
      },
      {
        description:isPushPress
          ? localizedNameFi+' lisää pienen jalkatyön, jolloin voiman siirtäminen raskaampaan yläasennon lukitukseen kehittyy.'
          : isBTN
            ? localizedNameFi+' haastaa olkapäiden liikkuvuutta ja yläselän hallintaa, ja sitä kannattaa käyttää vain jos asento tuntuu olkapäille hyvältä.'
            : isSeated
              ? localizedNameFi+' poistaa jalkatyön ja muun alavartalon avun, joten hartioiden ja keskivartalon on tehtävä kaikki vakautus.'
              : localizedNameFi+' on tärkein pystypunnerrus hartioiden, ojentajien ja ylävartalon tukivoiman kehittämiseen.',
        setup:isSeated
          ? 'Istu ryhdikkäästi, pidä jalkapohjat maassa, pakarat tiukkana ja rintakehä lantion päällä ennen kuin tanko irtoaa hartioilta.'
          : 'Aloita tanko tai käsipainot hartiakorkeudelta, purista pakarat ja vatsat tiukaksi ja pidä kyynärpäät hieman kuorman edessä.',
        execution:isPushPress
          ? ['Käy suoraan alas muutama sentti vartalo pystysuorana.', 'Aja voimakkaasti jaloilla, jotta tanko saa nopeuden hartioilta lähtiessä.', 'Viimeistele työntämällä itsesi tangon alle vakaaseen lukitukseen.']
          : ['Punnerra ylös liikuttamalla päätä ensin hieman taakse, jotta kuorma kulkee suoraa linjaa.', 'Kun kuorma ohittaa otsan, työnnä pää takaisin läpi ja pinoa kuorma hartioiden ja lantion päälle.', 'Laske hallitusti takaisin lähtöräkkiasentoon.'],
        cues:isPushPress
          ? ['Lyhyt suora dippi.','Jalat käynnistävät, kädet viimeistelevät.','Lukitse yläasento kovaa.']
          : ['Kyljet alas.','Punnerra läheltä kasvoja.','Pää läpi yläasennossa.'],
        safety:isBTN
          ? 'Jos et pysty pitämään kylkiä alhaalla ja olkapäitä kivuttomina niskan takaa painettaessa, jätä tämä variaatio pois.'
          : 'Jos alaselkä notkistuu voimakkaasti toiston lopussa, kuorma on nykyiselle hallinnallesi liian raskas.'
      }
    );
  }

  if(matchesGuidanceName(n,['barbell rows','dumbbell rows','chest-supported rows','chest supported rows','seated cable rows','machine rows','t-bar rows','pull-ups','chin-ups','neutral-grip pull-ups','assisted chin-ups','pull-downs','band pull-aparts','dead hangs'])){
    const isVerticalPull=matchesGuidanceName(n,['pull-ups','chin-ups','neutral-grip pull-ups','assisted chin-ups','pull-downs','dead hangs']);
    const isPullApart=n==='band pull-aparts';
    const isDeadHang=n==='dead hangs';
    return guidancePack(
      {
        description:isPullApart
          ? localizedNameEn+' is a light rear-delt and upper-back drill used to teach shoulder blade control and add fatigue-friendly pulling volume.'
          : isDeadHang
            ? localizedNameEn+' builds grip endurance, shoulder tolerance, and relaxed overhead hanging mechanics.'
            : isVerticalPull
              ? localizedNameEn+' trains a vertical pull pattern for lats, upper back, and shoulder control through a long range.'
              : localizedNameEn+' builds upper-back thickness and teaches you to keep the trunk fixed while the arms pull.',
        setup:isVerticalPull
          ? 'Grab the bar or handle with the intended grip, let the body hang or stretch long, and set the shoulders down before the first pull or hold.'
          : isPullApart
            ? 'Hold the band at shoulder height with soft elbows and enough tension that the band is already lightly loaded before you pull.'
            : 'Set the torso position first, brace the trunk, and let the shoulders reach into a stretch before you start each pull.',
        execution:isDeadHang
          ? ['Hang with the ribs lightly down and the shoulders organized instead of shrugging into the ears.', 'Breathe calmly while the hands, forearms, and shoulders support the body.', 'Step off before grip failure forces a violent drop.']
          : isPullApart
            ? ['Pull the band apart by moving both hands outward while the chest stays tall.', 'Finish when the shoulder blades move together without the low back arching hard.', 'Return slowly to the start so the rear delts keep tension both ways.']
            : isVerticalPull
              ? ['Initiate by pulling the elbows down toward the ribs instead of yanking with the neck.', 'Keep the ribcage controlled as you bring the chest toward the bar or handles.', 'Lower all the way to a long hang or stretch again without losing shoulder position.']
              : ['Start the pull by driving the elbows rather than shrugging the shoulders.', 'Pause briefly in the squeezed position so the back does the work.', 'Return under control to a stretch without losing trunk position.'],
        cues:isPullApart
          ? ['Long neck.','Hands move apart, ribs stay down.','Control the return.']
          : isDeadHang
            ? ['Relax the neck.','Own the hang.','Come down before grip slips.']
            : ['Lead with elbows.','Keep shoulders away from the ears.','Control both directions.'],
        safety:isDeadHang
          ? 'Do not stay hanging until the hands suddenly fail. Step down before the grip opens unexpectedly.'
          : isVerticalPull
            ? 'If you have to crane the neck or kip violently to finish the rep, use assistance or fewer reps so the movement stays clean.'
            : 'If the shoulders shrug up or the lower back starts swinging to create momentum, reduce load and tighten the setup.'
      },
      {
        description:isPullApart
          ? localizedNameFi+' on kevyt takaolkapään ja yläselän harjoite, jolla opetellaan lapojen hallintaa ja kerätään helposti palautuvaa vetovolyyymia.'
          : isDeadHang
            ? localizedNameFi+' kehittää puristusvoimaa, olkapäiden sietokykyä ja rentoa roikkumisasentoa tangossa.'
            : isVerticalPull
              ? localizedNameFi+' harjoittaa pystysuoraa vetokuviota leveille selkälihaksille, yläselälle ja olkapään hallinnalle pitkällä liikeradalla.'
              : localizedNameFi+' rakentaa yläselän massaa ja opettaa pitämään vartalon paikallaan samalla kun kädet vetävät.',
        setup:isVerticalPull
          ? 'Tartu tankoon tai kahvaan suunnitellulla otteella, anna vartalon tai taljan venyä pitkäksi ja vedä hartiat kevyesti alas ennen ensimmäistä vetoa tai pitoa.'
          : isPullApart
            ? 'Pidä nauha hartiakorkeudella kyynärpäät pehmeinä ja luo kevyt jännitys nauhaan jo ennen vetoa.'
            : 'Rakenna ensin vartalon asento, tue keskivartalo ja anna olkapäiden venyä ennen jokaista vetoa.',
        execution:isDeadHang
          ? ['Roiku kyljet kevyesti alhaalla ja hartiat järjestyksessä sen sijaan että painut korviin asti.', 'Hengitä rauhallisesti käsien, kyynärvarsien ja olkapäiden kannatellessa vartaloa.', 'Astu alas ennen kuin ote pettää hallitsemattomasti.']
          : isPullApart
            ? ['Vedä nauha auki viemällä käsiä ulospäin samalla kun rinta pysyy ryhdissä.', 'Lopeta, kun lapaluut lähentyvät ilman että alaselkä notkahtaa voimakkaasti.', 'Palauta hitaasti alkuun, jotta takaolkapäät tekevät töitä molempiin suuntiin.']
            : isVerticalPull
              ? ['Aloita veto viemällä kyynärpäitä alas kohti kylkiä sen sijaan että nykäiset niskalla.', 'Pidä kyljet hallinnassa kun tuot rintaa kohti tankoa tai kahvoja.', 'Laskeudu takaisin pitkään roikuntaan tai venytykseen menettämättä hartioiden asentoa.']
              : ['Aloita veto kyynärpäillä äläkä kohauttamalla hartioita.', 'Pidä yläasennossa lyhyt pysäytys, jotta selkä tekee työn.', 'Palauta hallitusti venytykseen menettämättä vartalon asentoa.'],
        cues:isPullApart
          ? ['Pitkä niska.','Kädet erilleen, kyljet alas.','Hallitse paluu.']
          : isDeadHang
            ? ['Niska rentona.','Omista roikunta.','Tule alas ennen otteen pettämistä.']
            : ['Johda kyynärpäillä.','Pidä hartiat poissa korvista.','Hallitse molemmat suunnat.'],
        safety:isDeadHang
          ? 'Älä roiku niin pitkään, että ote pettää yhtäkkiä. Astu alas ennen kuin kädet aukeavat odottamatta.'
          : isVerticalPull
            ? 'Jos joudut työntämään päätä eteen tai käyttämään voimakasta heiluria toiston loppuun, käytä avustusta tai tee vähemmän toistoja.'
            : 'Jos hartiat nousevat korviin tai alaselkä alkaa heilua vauhdin luomiseksi, kevennä kuormaa ja tiukennä aloitusasentoa.'
      }
    );
  }

  if(matchesGuidanceName(n,['weighted planks','pallof press','ab wheel rollouts','hanging leg raises','cable crunches','ab crunches','dead bugs'])){
    const isPlank=n==='weighted planks';
    const isPallof=n==='pallof press';
    const isWheel=n==='ab wheel rollouts';
    const isLegRaise=n==='hanging leg raises';
    const isCrunch=matchesGuidanceName(n,['cable crunches','ab crunches']);
    return guidancePack(
      {
        description:isPlank
          ? localizedNameEn+' trains trunk stiffness under load and is used to teach you how to hold position instead of leaking tension.'
          : isPallof
            ? localizedNameEn+' is an anti-rotation core drill that teaches the trunk to resist being twisted by the cable or band.'
            : isWheel
              ? localizedNameEn+' is a demanding anti-extension exercise for abs, lats, and trunk control.'
              : isLegRaise
                ? localizedNameEn+' trains the abs and hip flexors through a hanging position that also challenges grip and shoulder control.'
                : isCrunch
                  ? localizedNameEn+' lets you train spinal flexion for the abs with a load that is easy to progress gradually.'
                  : localizedNameEn+' teaches you to brace while the arms and legs move, which makes it one of the best beginner-friendly trunk control drills.',
        setup:isPlank
          ? 'Set forearms or hands firmly, stack the ribcage over the pelvis, and place the load so you can keep a straight line from shoulders to heels.'
          : isPallof
            ? 'Stand or kneel sideways to the cable, hold the handle at chest height, and square the hips and ribs before you press.'
            : isWheel
              ? 'Start kneeling with the wheel under the shoulders, glutes squeezed, and ribs tucked down before you roll.'
              : 'Set up in a position where the pelvis and ribcage can stay stacked before the movement begins.',
        execution:isPlank
          ? ['Brace the abs and glutes as if someone is about to punch your midsection.', 'Hold the body in one long line without letting the hips sag or pike upward.', 'End the set when breathing or posture becomes sloppy.']
          : isPallof
            ? ['Press the handle straight out from the chest while keeping the torso from rotating.', 'Pause with the arms extended and feel the trunk resist the pull sideways.', 'Bring the handle back in under control without twisting.']
            : isWheel
              ? ['Roll forward slowly while keeping the ribs tucked and the hips following the hands.', 'Go only as far as you can resist the low back dropping into extension.', 'Pull back by bracing the abs and lats, not by yanking with the hips.']
              : isLegRaise
                ? ['Start by lightly tucking the pelvis so the abs switch on before the legs move.', 'Raise the legs under control instead of swinging them up.', 'Lower to a dead hang again without losing shoulder position.']
                : isCrunch
                  ? ['Brace the hips in place and curl the ribcage toward the pelvis.', 'Think about shortening the abs rather than yanking with the arms.', 'Return under control to a stretch without losing the stacked starting position.']
                  : ['Press the low back gently toward the floor and keep the ribs down.', 'Reach the opposite arm and leg away slowly while the trunk stays still.', 'Return to the middle and alternate sides without letting the back arch.'],
        cues:isPlank
          ? ['Glutes tight.','Ribs stacked over pelvis.','Hold tension, do not just survive.']
          : isPallof
            ? ['Press straight out.','Do not let the torso turn.','Exhale into the brace.']
            : ['Move slowly.','Keep the low back quiet.','Quality beats range.'],
        safety:isWheel
          ? 'If the low back drops or pinches, shorten the rollout immediately. More range is not better if the trunk is no longer in control.'
          : 'When the lower back starts compensating, stop the set instead of forcing extra reps.'
      },
      {
        description:isPlank
          ? localizedNameFi+' opettaa pitämään keskivartalon jäykkänä kuorman alla sen sijaan, että tuki vuotaa pois.'
          : isPallof
            ? localizedNameFi+' on kiertoa vastustava keskivartaloharjoite, joka opettaa vartalon vastustamaan taljan tai nauhan vetoa sivulle.'
            : isWheel
              ? localizedNameFi+' on vaativa anti-ekstensioharjoite vatsalihaksille, leveille selkälihaksille ja keskivartalon hallinnalle.'
              : isLegRaise
                ? localizedNameFi+' kuormittaa vatsaa ja lonkankoukistajia roikkuvassa asennossa, jossa myös ote ja olkapään hallinta joutuvat töihin.'
                : isCrunch
                  ? localizedNameFi+' mahdollistaa selkärangan koukistuksen harjoittamisen vatsalle kuormalla, jota on helppo kasvattaa asteittain.'
                  : localizedNameFi+' opettaa tukemaan keskivartaloa samalla kun kädet ja jalat liikkuvat, joten se on yksi parhaista aloittelijaystävällisistä keskivartaloharjoitteista.',
        setup:isPlank
          ? 'Aseta kyynärvarret tai kädet tukevasti, pinoa rintakehä lantion päälle ja aseta kuorma niin, että vartalo pysyy suorana hartioista kantapäihin.'
          : isPallof
            ? 'Seiso tai polvistu sivuttain taljaan nähden, pidä kahvaa rinnan edessä ja suorista lantio sekä rintakehä ennen punnerrusta.'
            : isWheel
              ? 'Aloita polviltaan niin, että rulla on hartioiden alla, pakarat puristettuina ja kyljet alhaalla ennen liikkeelle lähtöä.'
              : 'Rakenna aloitusasento niin, että lantio ja rintakehä pysyvät pinottuna ennen liikettä.',
        execution:isPlank
          ? ['Purista vatsat ja pakarat tiukaksi kuin joku olisi lyömässä keskivartaloon.', 'Pidä vartalo pitkänä linjana ilman että lantio notkahtaa tai nousee liikaa.', 'Lopeta sarja, kun hengitys tai asento muuttuu huolimattomaksi.']
          : isPallof
            ? ['Punnerra kahva suoraan ulos rinnasta ilman että vartalo kiertyy.', 'Pysähdy kädet ojennettuina ja tunne kuinka keskivartalo vastustaa sivuvetoa.', 'Tuo kahva takaisin hallitusti ilman kiertoa.']
            : isWheel
              ? ['Rullaa eteen hitaasti pitäen kyljet alhaalla ja lantion seuraamassa käsiä.', 'Mene vain niin pitkälle kuin pystyt estämään alaselän notkistumisen.', 'Vedä takaisin tukemalla vatsalla ja leveillä selkälihaksilla, ei nykäisemällä lantiolla.']
              : isLegRaise
                ? ['Aloita kevyellä lantion kierrolla, jotta vatsa aktivoituu ennen jalkojen liikettä.', 'Nosta jalat hallitusti sen sijaan että heilautat ne ylös.', 'Laske takaisin pitkään roikuntaan menettämättä olkapäiden asentoa.']
                : isCrunch
                  ? ['Pidä lantio paikoillaan ja koukista rintakehää kohti lantiota.', 'Ajattele vatsan lyhenevän äläkä vedä käsillä.', 'Palauta hallitusti venytykseen menettämättä aloitusasennon pinoamista.']
                  : ['Paina alaselkää kevyesti lattiaa kohti ja pidä kyljet alhaalla.', 'Vie vastakkainen käsi ja jalka hitaasti poispäin vartalon pysyessä paikallaan.', 'Palaa keskelle ja vaihda puolta ilman että selkä notkahtaa.'],
        cues:isPlank
          ? ['Pakarat tiukaksi.','Kyljet lantion päällä.','Pidä jännitys, älä vain selviydy.']
          : isPallof
            ? ['Punnerra suoraan eteen.','Älä anna vartalon kiertyä.','Hengitä ulos tukea vasten.']
            : ['Liiku hitaasti.','Pidä alaselkä hiljaa.','Laatu voittaa liikelaajuuden.'],
        safety:isWheel
          ? 'Jos alaselkä notkahtaa tai nipistää, lyhennä rullausta heti. Pidempi liikerata ei ole parempi, jos keskivartalon hallinta katoaa.'
          : 'Kun alaselkä alkaa kompensoida, lopeta sarja sen sijaan että pakotat lisää toistoja.'
      }
    );
  }

  if(matchesGuidanceName(n,['dumbbell bicep curls','dumbbell lateral raises','overhead triceps extensions','skull crushers','cable triceps pressdowns'])){
    const isCurl=n==='dumbbell bicep curls';
    const isLateral=n==='dumbbell lateral raises';
    const isTri=isCurl!==true&&isLateral!==true;
    return guidancePack(
      {
        description:isCurl
          ? localizedNameEn+' adds direct elbow-flexor work when programs need more biceps and forearm volume than rows and chins alone provide.'
          : isLateral
            ? localizedNameEn+' isolates the side delts and is one of the simplest ways to make the shoulders do more of the visual work.'
            : localizedNameEn+' is a triceps isolation movement used to add elbow-extension volume without having to recover from another heavy press.',
        setup:isTri&&n==='cable triceps pressdowns'
          ? 'Stand tall with elbows pinned close to the torso and the cable already under light tension before you start pressing down.'
          : isTri&&n==='skull crushers'
            ? 'Lie on the bench with shoulders set, arms locked above the chest, and the implement balanced before the first rep.'
            : 'Choose a load you can control without body English and set the torso position before the first rep.',
        execution:isCurl
          ? ['Curl the weights by bending the elbows without letting the shoulders roll forward.', 'Squeeze at the top without swinging the torso back.', 'Lower under control until the elbows are nearly straight again.']
          : isLateral
            ? ['Raise the weights out to the side with soft elbows and the shoulders staying down.', 'Stop around shoulder height or slightly below if that keeps the side delts loaded best.', 'Lower slowly so the delts keep tension all the way down.']
            : n==='overhead triceps extensions'
              ? ['Lower the weight behind the head by bending at the elbows while the upper arms stay mostly still.', 'Stretch the triceps as far as you can without losing shoulder position.', 'Extend the elbows to finish while keeping the ribcage stacked.']
              : n==='skull crushers'
                ? ['Lower the bar or bells toward the forehead or just behind it by bending the elbows.', 'Keep the upper arms mostly fixed so the triceps, not the shoulders, do the work.', 'Extend the elbows smoothly back to lockout.']
                : ['Press the handle down by straightening the elbows while the upper arms stay tucked to the sides.', 'Squeeze the triceps hard at the bottom without shrugging.', 'Return until the elbows bend again but stay pinned in place.'],
        cues:isCurl
          ? ['Elbows stay near the sides.','No torso swing.','Lower slower than you lift.']
          : isLateral
            ? ['Lead with the elbows.','Shoulders stay down.','Own the lowering phase.']
            : ['Upper arm stays quiet.','Finish with the triceps.','Use control, not momentum.'],
        safety:isTri
          ? 'If the elbows start aching more than the triceps are working, reduce load and make the range pain-free rather than forcing depth.'
          : 'The moment the torso starts heaving to move the weight, the load is too heavy for the target muscle.'
      },
      {
        description:isCurl
          ? localizedNameFi+' lisää suoraa kyynärkoukistajatyötä silloin kun ohjelma tarvitsee enemmän hauis- ja kyynärvarsivolyymia kuin soudut ja leuat yksin tuottavat.'
          : isLateral
            ? localizedNameFi+' eristää keskimmäistä hartialihasta ja on yksi helpoimmista tavoista saada hartiat tekemään enemmän näkyvää työtä.'
            : localizedNameFi+' on ojentajan eristävä liike, jolla lisätään kyynärnivelen ojennusvolyymia ilman että täytyy palautua vielä yhdestä raskaasta punnerruksesta.',
        setup:isTri&&n==='cable triceps pressdowns'
          ? 'Seiso ryhdissä, pidä kyynärpäät kyljissä kiinni ja luo taljaan kevyt jännitys jo ennen alas painamista.'
          : isTri&&n==='skull crushers'
            ? 'Asetu penkille niin, että olkapäät ovat tuettuina, kädet ojennettuina rinnan yläpuolelle ja väline tasapainossa ennen ensimmäistä toistoa.'
            : 'Valitse kuorma, jota pystyt hallitsemaan ilman vartalon huijausta, ja rakenna vartalon asento ennen ensimmäistä toistoa.',
        execution:isCurl
          ? ['Käännä painot ylös koukistamalla kyynärpäitä ilman että olkapäät kiertyvät eteen.', 'Purista yläasennossa ilman että nojaat vartalolla taakse.', 'Laske hallitusti takaisin lähes suorille käsille.']
          : isLateral
            ? ['Nosta painot sivuille pehmeillä kyynärpäillä ja pidä hartiat alhaalla.', 'Pysähdy noin hartiakorkeudelle tai hieman sen alle, jos se pitää jännityksen paremmin hartiassa.', 'Laske hitaasti niin, että hartialihas tekee töitä koko matkan.']
            : n==='overhead triceps extensions'
              ? ['Laske paino pään taakse koukistamalla kyynärpäitä samalla kun olkavarret pysyvät melko paikallaan.', 'Venytä ojentajaa niin pitkälle kuin pystyt menettämättä olkapään asentoa.', 'Ojenna kyynärpäät loppuun asti pitäen rintakehä pinottuna.']
              : n==='skull crushers'
                ? ['Laske tanko tai käsipainot otsaa tai hieman sen taakse kohti koukistamalla kyynärpäitä.', 'Pidä olkavarret lähes paikallaan, jotta ojentaja tekee työn eikä olkapää.', 'Ojenna kyynärpäät takaisin lukitukseen tasaisesti.']
                : ['Paina kahva alas ojentamalla kyynärpäät samalla kun olkavarret pysyvät kyljissä.', 'Purista ojentajaa ala-asennossa ilman hartioiden kohautusta.', 'Palaa hallitusti takaisin niin, että kyynärpäät koukistuvat mutta pysyvät paikoillaan.'],
        cues:isCurl
          ? ['Kyynärpäät lähellä kylkiä.','Ei vartalon heilautusta.','Laske hitaammin kuin nostat.']
          : isLateral
            ? ['Johda kyynärpäillä.','Hartiat alas.','Omista laskuvaihe.']
            : ['Olkavarsi pysyy rauhallisena.','Viimeistele ojentajalla.','Käytä hallintaa, älä vauhtia.'],
        safety:isTri
          ? 'Jos kyynärpäät ärtyvät enemmän kuin ojentaja tekee töitä, kevennä kuormaa ja tee kivuton liikerata mieluummin kuin pakotat syvyyttä.'
          : 'Heti kun vartalo alkaa nykiä painoa liikkeelle, kuorma on kohdelihakselle liian raskas.'
      }
    );
  }
  return null;
}

function guidanceFor(name,category){
  const localizedNameEn=getDisplayName(name,'en')||name;
  const localizedNameFi=getDisplayName(name,'fi')||name;
  const specific=getSpecificGuidance(name,localizedNameEn,localizedNameFi);
  if(specific)return specific;
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
  const metadataOverride=EXERCISE_METADATA_OVERRIDES[normalize(entry.name)]||{};
  const category=entry.category||metadataOverride.category||inferCategory(entry.name);
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
  const metadataOverride=EXERCISE_METADATA_OVERRIDES[normalize(raw)]||{};
  const category=metadataOverride.category||inferCategory(raw);
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

function getExerciseLibrary(){
  return window.EXERCISE_LIBRARY||null;
}

function hasExerciseLibrary(){
  return !!getExerciseLibrary();
}

function resolveRegisteredExerciseId(input){
  const library=getExerciseLibrary();
  if(!library||typeof library.resolveExerciseId!=='function')return null;
  return library.resolveExerciseId(input)||null;
}

function getRegisteredExercise(input){
  const library=getExerciseLibrary();
  if(!library||typeof library.getExercise!=='function')return null;
  return library.getExercise(input)||null;
}

function getExerciseMetadata(input,locale){
  const library=getExerciseLibrary();
  if(!library||typeof library.getExerciseMeta!=='function')return null;
  return library.getExerciseMeta(input,locale)||null;
}

function getExerciseDisplayName(input,locale){
  const library=getExerciseLibrary();
  if(!library||typeof library.getDisplayName!=='function'){
    return String(typeof input==='object'?input?.name||'':input||'');
  }
  return library.getDisplayName(input,locale)||'';
}

function getExerciseGuidanceFor(input,locale){
  const library=getExerciseLibrary();
  if(!library||typeof library.getExerciseGuidance!=='function')return null;
  return library.getExerciseGuidance(input,locale)||null;
}

function mapExerciseMuscleToDisplayGroup(muscle){
  const library=getExerciseLibrary();
  if(!library||typeof library.mapMuscleToDisplayGroup!=='function')return null;
  return library.mapMuscleToDisplayGroup(muscle)||null;
}

function listRegisteredExercises(options){
  const library=getExerciseLibrary();
  if(!library||typeof library.getExerciseList!=='function')return [];
  return library.getExerciseList(options)||[];
}

function searchRegisteredExercises(query,filters){
  const library=getExerciseLibrary();
  if(!library||typeof library.searchExercises!=='function')return [];
  return library.searchExercises(query,filters)||[];
}

function getRelatedRegisteredExercises(exerciseId,options){
  const library=getExerciseLibrary();
  if(!library||typeof library.getRelatedExercises!=='function')return [];
  return library.getRelatedExercises(exerciseId,options)||[];
}

function registerCustomExercise(definition){
  const library=getExerciseLibrary();
  if(!library||typeof library.registerExercise!=='function')return null;
  return library.registerExercise(definition)||null;
}

window.getExerciseLibrary=getExerciseLibrary;
window.hasExerciseLibrary=hasExerciseLibrary;
window.resolveRegisteredExerciseId=resolveRegisteredExerciseId;
window.getRegisteredExercise=getRegisteredExercise;
window.getExerciseMetadata=getExerciseMetadata;
window.getExerciseDisplayName=getExerciseDisplayName;
window.getExerciseGuidanceFor=getExerciseGuidanceFor;
window.mapExerciseMuscleToDisplayGroup=mapExerciseMuscleToDisplayGroup;
window.listRegisteredExercises=listRegisteredExercises;
window.searchRegisteredExercises=searchRegisteredExercises;
window.getRelatedRegisteredExercises=getRelatedRegisteredExercises;
window.registerCustomExercise=registerCustomExercise;

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
