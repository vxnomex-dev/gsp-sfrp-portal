/**
 * Standard Operating Procedure — Trooper Handbook (author: Lt. Col. Jacob Everson).
 * Shown on the Department Information page. Edit the text here; the page updates automatically.
 * Section/subsection numbers are kept exactly as in the original handbook.
 */

export type SopSubsection = {
  num: string;
  title: string;
  /** Paragraphs. A paragraph may start with a bold lead-in: { lead: "…:", text: "…" } */
  body: (string | { lead: string; text: string })[];
};
export type SopGroup = { title?: string; items: SopSubsection[] };
export type SopSection = { id: string; numeral: string; title: string; groups: SopGroup[] };

export const SOP_META = {
  title: "Standard Operating Procedure",
  subtitle: "Trooper Handbook",
  author: "Jacob Everson",
};

export const SOP: SopSection[] = [
  {
    id: "sop-driving",
    numeral: "I",
    title: "Driving Regulations",
    groups: [
      {
        items: [
          {
            num: "1.01",
            title: "General Vehicle Operation and Safety Standards",
            body: [
              "All sworn troopers operating Georgia State Patrol vehicles shall exercise due regard for the safety of all persons and property at all times. Agency vehicles must be operated in full compliance with Georgia State law and local ordinances unless specific emergency exemptions apply under Georgia law. Troopers are personally responsible for the safe and prudent operation of their assigned vehicle. Operational courteousness, defensive driving tactics, and continuous situational awareness are required during both emergency and non-emergency operations.",
            ],
          },
          {
            num: "1.02",
            title: "Emergency Response and Code 3 Operations",
            body: [
              "Code 3 response (emergency lights and siren activated) is authorized only when responding to emergency calls involving an immediate threat to human life, grave bodily injury, or violent felony crimes in progress. Emergency warning equipment does not relieve a trooper of the duty to drive with due regard for the safety of all persons. When navigating intersections against traffic signals or stop signs during a Code 3 response, the vehicle must come to a complete stop or slow to a speed that allows complete control and clear line-of-sight before proceeding safely through the intersection.",
            ],
          },
          {
            num: "1.03",
            title: "Vehicle Inspection, Maintenance, and Pre-Shift Protocols",
            body: [
              "Prior to beginning any operational shift, troopers must conduct a comprehensive pre-shift inspection of their assigned vehicle. This inspection includes checking fluid levels, tire pressure and tread integrity, braking system responsiveness, operational status of all emergency lights and sirens, in-car camera systems, radio communication apparatus, and Computer Aided Dispatch. Any mechanical defect, body damage, or malfunction must be logged immediately in the fleet management system and reported to the shift supervisor before deploying the vehicle into service.",
            ],
          },
          {
            num: "1.04",
            title: "Seat Belt Mandatory Compliance and Passenger Safety",
            body: [
              "All occupants of agency vehicles, including sworn personnel, civilian employees, trainees, riders, and detained individuals, are required to properly wear seat belts at all times when the vehicle is in motion. Unbelted operation is strictly prohibited except under extraordinary tactical circumstances where immediate egress is necessary and specifically authorized by a supervisor. Detained individuals must be secured with seat belts in the rear transport compartment prior to transport, regardless of distance.",
            ],
          },
          {
            num: "1.05",
            title: "Speed Restrictions and Due Regard Standards",
            body: [
              "Troopers operating agency vehicles shall not exceed posted speed limits during routine non-emergency transit. During emergency operations (Code 3), troopers may exceed posted speed limits only when road, weather, traffic, and environmental conditions permit such operation with reasonable safety. Excessive speeds that compromise control or create an unacceptable risk of collision are strictly forbidden regardless of call urgency.",
            ],
          },
          {
            num: "1.06",
            title: "Use of Non-Emergency Warning Equipment and Signals",
            body: [
              "Emergency warning devices (emergency lightbars, directional stick lights, and public address systems) may be utilized during non-emergency conditions strictly for traffic hazard control, scene protection, motorist assistance, or traffic stops. Directional turn signals must be consistently used during all lane changes, turns, and maneuvers. Pacing techniques or secondary enforcement maneuvers must be conducted without endangering surrounding vehicular traffic.",
            ],
          },
          {
            num: "1.07",
            title: "Operation of Agency Vehicles Under Adverse Weather and Road Conditions",
            body: [
              "During severe weather conditions — including torrential rain, severe storms, fog, localized flooding, or standing water — troopers must reduce operational speeds below posted limits to maintain vehicle control. Hydroplaning risks must be actively mitigated. Code 3 responses shall be automatically downgraded to non-emergency response if severe weather reduces visibility below safe stopping distances or renders road surfaces dangerously slick.",
            ],
          },
          {
            num: "1.08",
            title: "Distracted Driving, Electronic Device Usage, and In-Car Technology",
            body: [
              "Troopers must minimize distractions while operating an agency vehicle. Personal cellular devices shall not be operated while the vehicle is in motion. CAD displays should be viewed only while the vehicle is stationary, except for brief, safe checks of vital call information. When extended communication or typing is required, the trooper must park the vehicle in a safe location prior to interacting with technology displays.",
            ],
          },
          {
            num: "1.09",
            title: "Backing, Parking, and Low-Speed Maneuver Procedures",
            body: [
              "Backing collisions represent preventable operational hazards. Troopers must exercise heightened caution when executing backing maneuvers, utilizing mirrors, backup cameras, and visual checks. Whenever backing in tight spaces, blind spots, or congested emergency scenes, troopers should utilize a spotter when another officer or trooper is present. Parked agency vehicles must be placed in 'Park', parking brakes set when parked on inclines, and emergency lights activated when parked in roadway lanes.",
            ],
          },
          {
            num: "1.10",
            title: "Vehicle Accidents, Collision Reporting, and Administrative Review Board",
            body: [
              "Any motor vehicle collision involving an agency vehicle — regardless of damage severity or injury status — must be reported immediately to Communications and an on-duty supervisor. An independent traffic crash investigation must be conducted by an outside agency or specialized traffic crash reconstruction unit. All agency vehicle crashes undergo formal administrative evaluation by the GSP Vehicle Accident Review Board to determine preventable versus non-preventable classification and appropriate remedial training or disciplinary action.",
            ],
          },
          {
            num: "1.11",
            title: "Specialized Vehicle Operations",
            body: [
              "Specialized units including Marine Units, Off-Road / ATV Vehicles, and Tactical Armored Vehicles must adhere to specialized operational parameters and certification guidelines in addition to general driving policies.",
            ],
          },
          {
            num: "1.12",
            title: "Off-Duty and Take-Home Vehicle Policies",
            body: [
              "Take-home vehicle privileges are granted to authorized personnel based on operational readiness, call-out status, and residence within approved geographical boundaries. Take-home vehicles are restricted to official business, authorized call-outs, and approved off-duty detail transit. Operating take-home vehicles while under the influence of alcohol, prescription narcotics, or any impairing substance is strictly prohibited and shall result in immediate termination.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "sop-force",
    numeral: "II",
    title: "Use of Force Regulations",
    groups: [
      {
        title: "Lethal / Deadly Force",
        items: [
          {
            num: "1.10",
            title: "Core Philosophy and Definition of Lethal / Deadly Force",
            body: [
              "Lethal force (deadly force) is defined as force that is intended or likely to cause death or serious bodily harm. The Georgia State Patrol holds the sanctity of human life as a core administrative value. Lethal force represents the ultimate level of physical force and must be utilized only when objectively reasonable under the totality of circumstances, as evaluated from the perspective of a reasonable trooper on the scene at the moment force is applied.",
            ],
          },
          {
            num: "1.11",
            title: "Authorization Standards and Imminent Threat Criteria",
            body: [
              "A trooper is authorized to use lethal force only when the trooper reasonably believes that such force is immediately necessary to protect the trooper or another person from an imminent threat of death or serious bodily harm. Imminent threat requires that the suspect possesses the capability, opportunity, and clear intent to inflict lethal or severe physical injury immediately.",
            ],
          },
          {
            num: "1.12",
            title: "Prohibition of Firing at or From Moving Vehicles",
            body: [
              "Troopers shall not discharge firearms at or from a moving vehicle unless extraordinary circumstances exist where the occupants of the vehicle are using lethal force against the trooper or others by means other than the vehicle itself, or the vehicle is being operated as an intentional weapon of mass destruction or targeted lethal strike and no reasonable option for tactical escape exists.",
            ],
          },
          {
            num: "1.13",
            title: "Warning Shots and Unauthorized Uses of Deadly Force",
            body: [
              "Warning shots are strictly prohibited under all circumstances. Firing warning shots creates unacceptable risks of unpredictable ricochet, collateral injury to bystanders, and tactical confusion. Lethal force shall never be used as a tool to prevent property destruction, to subdue a non-violent fleeing felon who poses no immediate deadly threat, or as a punitive measure.",
            ],
          },
          {
            num: "1.14",
            title: "Tactical Decision-Making and De-escalation Prerequisites",
            body: [
              "Where feasible and where time and safety permit, troopers must attempt to de-escalate situations through tactical positioning, verbal commands, time, distance, and shielding prior to resorting to lethal force. Lethal force must be a measure of last resort when less-lethal options are ineffective or objectively inappropriate given the immediate danger presented.",
            ],
          },
          {
            num: "1.15",
            title: "Immediate Post-Discharge Protocols and Scene Containment",
            body: [
              "Immediately following a discharge of a firearm involving lethal force, the discharging trooper(s) shall immediately secure the weapon, ensure personal and public safety, request immediate emergency medical services (EMS), notify the communications center, and establish dynamic perimeter security to preserve the crime scene.",
            ],
          },
          {
            num: "1.16",
            title: "Medical Assistance Mandate Following Lethal Force Application",
            body: [
              "Troopers have an affirmative duty to provide immediate emergency medical aid, CPR, and hemorrhage control to any injured individual — including fleeing or aggressive suspects — as soon as the scene is rendered safe and tactical threats are neutralized. EMS must be dispatched concurrently with scene stabilization.",
            ],
          },
          {
            num: "1.17",
            title: "Mandatory Reporting, Notification, and Documentation Procedures",
            body: [
              "Any discharge of a firearm (excluding authorized firearms training or destruction of severely injured dangerous animals) requires immediate notification to the Shift Commander, Major Crimes Division, and Human Resources. Detailed written Use of Force Reports must be submitted within timeframes specified by administrative policy.",
            ],
          },
          {
            num: "1.18",
            title: "Administrative Leave, Psychological Evaluation, and Support",
            body: [
              "Any trooper involved in a critical incident involving the application of lethal force or resulting in death or severe injury shall be placed on non-disciplinary Administrative Leave with pay pending initial review. Mandatory psychological debriefing and clearance by a licensed mental health clinician are required prior to returning to operational status.",
            ],
          },
          {
            num: "1.19",
            title: "Internal Investigations, Shooting Review Board, and External Inquiry",
            body: [
              "All deadly force incidents are subjected to a rigorous, multi-layered investigation conducted by Human Resources, the State Attorney's Office, and the GSP Use of Force Shooting Review Board to assess compliance with state laws and agency operational policies.",
            ],
          },
          {
            num: "1.20",
            title: "Annual Training Requirements and Qualification Standards",
            body: [
              "All sworn personnel must successfully complete annual firearm qualifications, tactical judgment shoot-house scenarios, de-escalation refresher courses, and deadly force legal standards reviews. Failure to qualify renders a trooper subject to immediate suspension of enforcement powers.",
            ],
          },
        ],
      },
      {
        title: "Conducted Electrical Weapons (Taser)",
        items: [
          {
            num: "2.10",
            title: "Purpose, Definition, and Authorization of Conducted Energy Devices",
            body: [
              "A Conducted Electrical Weapon (CEW / Conducted Energy Weapon / Taser) is an intermediate less-lethal force option designed to incapacitate aggressive subjects by applying neuromuscular incapacitation (NMI) or drive-stun pain compliance. CEWs may only be carried and deployed by troopers who have successfully completed official agency certification.",
            ],
          },
          {
            num: "2.11",
            title: "Deployment Criteria and Target Selection Guidelines",
            body: [
              "CEW deployment is authorized only when a subject displays active physical resistance, active aggression, or poses an immediate physical threat to troopers or citizens. Preferred target zones for probe deployment are the lower center-mass back or below the chest/abdomen on the front to maximize NMI effectiveness and reduce cardiac risk factors.",
            ],
          },
          {
            num: "2.12",
            title: "Prohibited Applications and High-Risk Populations",
            body: [
              "CEW deployment is strictly prohibited on subjects who display passive resistance. CEW shall not be deployed on pregnant females, elderly individuals, young children, individuals operating motor vehicles/machinery, persons in elevated positions where a fall could cause death or severe injury, or in environments containing flammable vapors or explosives.",
            ],
          },
          {
            num: "2.13",
            title: "Probe Placement, Cycle Duration, and Multiple Deployments",
            body: [
              "Standard CEW activation consists of a standard 5-second cycle. Troopers must evaluate the effects of the initial cycle before applying additional cycles. Multiple or continuous applications exceeding 15 seconds total exposure must be avoided unless extraordinary physical danger persists, as prolonged exposures carry heightened physiological risks.",
            ],
          },
          {
            num: "2.14",
            title: "Drive-Stun Mode Guidelines and Restrictions",
            body: [
              "Drive-stun mode functions solely as a pain compliance technique and does not cause neuromuscular incapacitation. Drive-stun mode should be limited to close-quarters tactical containment, weapon-retention defense, or to complete an electrical circuit when probe placement fails. Repeated drive-stuns without tactical progress are prohibited.",
            ],
          },
          {
            num: "2.15",
            title: "Post-Deployment Medical Care and Probe Removal Standards",
            body: [
              "Once a subject is safely handcuffed, medical evaluation by EMS is mandatory. Depleted probes that have penetrated sensitive anatomical zones (head, neck, groin, female breast area) shall only be removed by qualified medical personnel. Non-sensitive probe removals may be conducted by certified troopers in accordance with agency medical guidelines.",
            ],
          },
          {
            num: "2.16",
            title: "Equipment Maintenance, Battery Care, and Data Download Protocols",
            body: [
              "Troopers are responsible for inspecting their assigned CEW daily, verifying battery charge status, checking probe cartridge expiration dates, and performing daily spark-tests. CEW internal event logs and video telemetry must be routinely downloaded and audited by supervisors for accountability.",
            ],
          },
          {
            num: "2.17",
            title: "Reporting Requirements and Supervisory Notifications",
            body: [
              "Every CEW deployment — including intentional discharges, drive-stuns, probe deployments, and accidental discharges — requires immediate supervisory notification and submission of an official Use of Force / CEW Incident Report prior to the end of shift.",
            ],
          },
          {
            num: "2.18",
            title: "Accidental Discharge Procedures and Investigation",
            body: [
              "Accidental CEW discharges must be reported immediately to a supervisor. The device, spent cartridge, and data log shall be impounded for technical audit by Human Resources to determine whether the discharge resulted from mechanical failure or trooper negligence.",
            ],
          },
          {
            num: "2.19",
            title: "Tactical Positioning and Back-up Officer Coordination",
            body: [
              "Troopers operating CEWs should coordinate with a secondary covering trooper equipped with lethal force cover whenever feasible. Because CEWs may fail to achieve connection, lethal cover ensures immediate officer safety in high-risk violent encounters.",
            ],
          },
          {
            num: "2.20",
            title: "Recertification and Mandatory Scenario-Based Training",
            body: [
              "Sworn personnel authorized to carry CEWs must undergo annual recertification, including written legal testing, practical target accuracy evaluations, dynamic scenario-based decision-making drills, and medical mitigation protocols.",
            ],
          },
          {
            num: "2.21",
            title: "Deployment During Foot Pursuits over Uneven Terrain",
            body: [
              "If a suspect running on foot continues to run on uneven terrain and does not stop while being commanded, then the trooper has full justification to use the Conducted Electrical Weapon (CEW / Taser) to prevent further flight and neutralize potential safety risks associated with high-speed pursuit on hazardous ground.",
            ],
          },
        ],
      },
      {
        title: "OC Spray and Impact Weapons (Baton)",
        items: [
          {
            num: "3.10",
            title: "Purpose, Definitions, and Deployment Authorization for Chemical Agents (OC Spray)",
            body: [
              "Oleoresin Capsicum (OC / Pepper Spray) is an authorized less-lethal chemical restraint agent causing temporary inflammatory effects, inflammatory irritation of eyes, respiratory discomfort, and skin burning. OC spray is authorized to subdue actively resistant or aggressive subjects during physical confrontations.",
            ],
          },
          {
            num: "3.11",
            title: "Effective Range, Spraying Techniques, and Environmental Considerations",
            body: [
              "OC spray should be applied in short 1- to 2-second bursts directed toward the suspect's eyes and facial area from an effective distance of 4 to 10 feet. Troopers must account for crosswind, interior ventilation systems, and potential cross-contamination of innocent bystanders or secondary officers.",
            ],
          },
          {
            num: "3.12",
            title: "Decontamination Protocols and Mandatory Medical Evaluation for OC",
            body: [
              "As soon as a suspect exposed to OC spray is secured, troopers must initiate decontamination procedures. Decontamination includes flushing affected facial areas with clean cool water, exposing the individual to fresh air, and continuous monitoring. EMS must evaluate any subject exhibiting respiratory distress or prolonged distress exceeding 30 minutes.",
            ],
          },
          {
            num: "3.13",
            title: "Prohibited Uses of Chemical Agents and Hazardous Exposure Controls",
            body: [
              "OC spray shall not be used against passive demonstrators, non-resistant subjects, or as a retaliatory measure. OC spray shall never be deployed in close proximity to open flames or in unventilated confined spaces unless no safer force alternative exists.",
            ],
          },
          {
            num: "3.14",
            title: "Purpose, Authorized Impact Weapons (Baton), and Carrying Mandates",
            body: [
              "Expandable wooden or metal police batons are authorized less-lethal impact weapons designed for physical defense and control of aggressive subjects. Troopers must only carry agency-approved expandable batons and maintain active certification in defensive impact techniques.",
            ],
          },
          {
            num: "3.15",
            title: "Target Areas for Impact Weapons: Primary, Secondary, and Lethal Zones",
            body: [
              "Baton strikes must be strictly targeted toward primary target zones: muscle masses of the nerve motor points in the legs and arms (thighs, calves, upper arms). Secondary target zones include joint structures. Strikes to lethal target zones including the head, neck, throat, spine, solar plexus, and groin are classified as lethal force and are prohibited unless deadly force standards apply.",
            ],
          },
          {
            num: "3.16",
            title: "Prohibited Baton Strikes and Unauthorized Escalation",
            body: [
              "Using an impact weapon to strike an incapacitated, compliant, or non-threatening individual is strictly forbidden. Using batons as chokeholds, neck restraints, or unauthorized lever leverage against vital spinal areas is prohibited.",
            ],
          },
          {
            num: "3.17",
            title: "Mandatory Post-Impact Medical Assessment and Evidence Documentation",
            body: [
              "Any subject struck with an impact weapon must receive immediate medical examination by qualified medical staff at a medical facility or by EMS on scene. All impact locations, bruising, or injuries must be photographed and documented thoroughly in official reports.",
            ],
          },
          {
            num: "3.18",
            title: "Supervisory Response, Incident Scene Preservation, and Use-of-Force Reports",
            body: [
              "An on-duty supervisor must respond immediately to the scene of any impact weapon deployment. The supervisor shall photograph the scene, interview witnesses, secure body-worn camera video, and complete a formal Use of Force Investigation Report.",
            ],
          },
          {
            num: "3.19",
            title: "Equipment Care, Inspection, and Replacement Standards for Batons and OC",
            body: [
              "Troopers must regularly inspect batons for structural integrity, locking mechanism function, and rust. OC canisters must be inspected for pressure leakage and weight validation, replacing expired canisters prior to field deployment.",
            ],
          },
          {
            num: "3.20",
            title: "Annual Re-Qualification and Tactical Physical Proficiency Standards",
            body: [
              "Troopers are required to complete annual re-qualification training in defensive tactics, baton strike accuracy, weapon retention, and chemical agent handling to maintain operational readiness.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "sop-stops",
    numeral: "III",
    title: "Traffic Stop Regulations",
    groups: [
      {
        items: [
          {
            num: "3.01",
            title: "Pre-Stop Tactical Evaluation, Location Selection, and Dispatch Communications",
            body: [
              "Prior to initiating any traffic stop, a trooper must evaluate the surrounding tactical environment, select a safe location (well-lit area, wide shoulder, away from heavy high-speed traffic), and broadcast crucial information to Dispatch. Dispatch notification must include vehicle license plate number, state, vehicle description, number of visible occupants, location, and reason for the stop.",
            ],
          },
          {
            num: "3.02",
            title: "High-Risk (Felony) Traffic Stop Procedures and Tactics",
            body: [
              "When conducting a high-risk traffic stop involving suspects wanted for violent felonies, stolen vehicles, or suspected armed occupants, standard single-trooper approach procedures are prohibited. Troopers must request backup, initiate a multi-unit tactical disposition, position police vehicles in defensive offset angles, utilize vehicle doors as cover, and issue verbal commands over the PA system to systematically extract occupants one at a time.",
            ],
          },
          {
            num: "3.03",
            title: "Standard Traffic Enforcement Procedures, Motorist Interactions, and Professional Conduct",
            body: [
              "During routine traffic stops, troopers must maintain professional demeanor, state the reason for the stop clearly to the driver, and maintain vigilant tactical awareness. Tactical approach position (passenger-side approach or driver-side rear-pillar approach) must be selected based on roadway hazards and threat assessment. Driver credentials (driver's license, vehicle registration, and proof of insurance) must be verified promptly.",
            ],
          },
          {
            num: "3.04",
            title: "Driver Identification, Vehicle Searches, and Fourth Amendment Compliance",
            body: [
              "All vehicle searches conducted during traffic stops must strictly comply with Fourth Amendment legal mandates. Searches may only occur pursuant to a valid warrant, voluntary written/recorded consent, probable cause under the automobile exception, lawful arrest inventory procedures, or a protective frisk for weapons based on reasonable suspicion that an occupant is armed and dangerous.",
            ],
          },
          {
            num: "3.05",
            title: "Traffic Stop Documentation, Citation Issuance, and Body-Worn Camera (BWC) Protocols",
            body: [
              "Body-Worn Cameras must be activated prior to initiating the traffic stop signal and remain active continuously until the interaction is fully concluded and all vehicles have departed. Every traffic stop must result in formal documentation within the CAD system, including the disposition (warning, uniform traffic citation, or criminal arrest) and required demographic reporting data.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "sop-pursuits",
    numeral: "IV",
    title: "Pursuit Regulations",
    groups: [
      {
        items: [
          {
            num: "4.01",
            title: "Pursuit Initiation Criteria, Environmental Risk Analysis, and Vehicle Sizing Eligibility",
            body: [
              "A motor vehicle pursuit is authorized only when there is reasonable suspicion that the fleeing subject has committed, or is about to commit, a forcible violent felony involving the threat or use of deadly force. Pursuits for property crimes, traffic infractions, non-violent misdemeanors, or stolen vehicles without violent felony aggravating factors are strictly prohibited.",
              {
                lead: "Vehicle Sizing and Fleet Performance Restrictions:",
                text: "Pursuits may only be initiated and conducted by authorized high-speed rated patrol vehicles (e.g., pursuit-rated sedans or high-performance interceptor patrol units). Large utility vehicles, heavy trucks, or full-size SUVs (such as Chevrolet Tahoes — the Chevlon Camion PPV in ER:LC) are strictly prohibited from entering or engaging in active vehicle pursuits, EXCEPT under the explicit condition that the fleeing vehicle is of equivalent size or larger than the Chevy Tahoe (e.g., large full-size SUVs, commercial trucks, heavy utility vehicles, or semi-trucks). If the fleeing vehicle is a smaller passenger car, sedan, compact vehicle, or motorcycle, a Tahoe or large utility vehicle shall NOT engage under any circumstances and must immediately yield the lead pursuit role to a high-speed sedan/interceptor unit or terminate pursuit involvement.",
              },
            ],
          },
          {
            num: "4.02",
            title: "Roles and Responsibilities of Primary, Secondary, and Supervisory Units",
            body: [
              "No more than two agency vehicles (Primary Unit and Secondary Unit) shall participate in an active pursuit unless specifically authorized by the Field Supervisor. The Primary Unit is responsible for vehicle operation and maintaining visual contact; the Secondary Unit shall handle radio communications and track location updates. The Shift Supervisor holds absolute authority to order the immediate termination of any pursuit at any time based on public safety risk assessment.",
            ],
          },
          {
            num: "4.03",
            title: "Authorized Interception Tactics, PIT Maneuvers, Tire Deflation Devices, and Pursuit Restrictions",
            body: [
              "Precision Immobilization Technique (PIT) maneuvers and Tire Deflation Devices (spike strips) are authorized tactical interventions that may only be deployed by troopers trained and certified in their application, under explicit supervisory approval. PIT maneuvers conducted at speeds exceeding 40 mph are classified as lethal force and are prohibited unless deadly force criteria are met. Ramming, boxing-in, and stationary roadblocks are prohibited force tactics unless authorized under lethal force parameters.",
            ],
          },
          {
            num: "4.04",
            title: "Inter-Jurisdictional Pursuits, Air Support Coordination, and Radio Communications",
            body: [
              "When a pursuit enters or approaches adjacent municipal or county jurisdictions, Dispatch shall immediately notify the neighboring law enforcement agencies. Agency units shall not enter another jurisdiction unless authorized by the GSP supervisor. Once the GSP Aviation Unit (Air One) visualizes and assumes tracking of the fleeing vehicle, ground pursuit units shall immediately fall back and deactivate Code 3 warning equipment to diminish the suspect's aggressive driving risk.",
            ],
          },
          {
            num: "4.05",
            title: "Pursuit Termination Mandates, Post-Pursuit Reporting, and Executive Administrative Review",
            body: [
              "A pursuit must be immediately terminated whenever environmental risks (e.g., school zones, heavy pedestrian traffic, severe weather, mechanical failure) outweigh the immediate necessity of apprehending the suspect, or whenever ordering authority is issued by a supervisor. Upon pursuit termination, troopers must deactivate Code 3 equipment, pull to the shoulder, and turn away from the suspect's direction of travel. Every pursuit undergoes mandatory administrative review by the Command Staff and Pursuit Review Board.",
            ],
          },
        ],
      },
    ],
  },
];
