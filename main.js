// @ts-check

import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AREA, DRAG_COEFFICIENT, earth_mass_object, EARTH_RADIUS, EARTH_RADIUS_SQ, GRAVITY_CONSTANT, VOLUMEETRIC_DENSITY } from "./Constants";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Object3D, Vector3 } from "three";
import { cameraFunc, earthFunc, lights, misc, moonFunc, rendererFunc, sunFunc } from "./EnvironmentIyad";
import { destroyFolder, guiFunc, satellitesFolders, updatePrototype } from "./GUIyad";


export const scene = new THREE.Scene();

scene.add(new THREE.AxesHelper(EARTH_RADIUS / 10));

const earth = earthFunc(scene);
const moon = moonFunc(scene);
const sun = sunFunc(scene);

const gltfLoader = new GLTFLoader();
var satellites = new Array();

function calculate_height(V) {
  let height = ((V.length()) - EARTH_RADIUS);
  return height;
}

let time = { timeScale: 1 };

guiFunc(satellites, time);

export function addSatellite(pos, mass, radius, speed, Vi) {
  let satellite = {
    object: new Object3D(),
    displacement: new Vector3(0, 0, 0),
    V: new Vector3(0, 0, 0),
    arrows: new Array(),
    height: 0,
    mass: 0,
    radius: 0
  }
  satellite.object.position.set(pos.x, pos.y, pos.z);
  satellite.height = calculate_height(pos);
  satellite.mass = mass;
  satellite.raduis = radius;

  gltfLoader.load("./assets/sputnik2.gltf", (gltf) => {
    satellite.object.add(gltf.scene);
    satellite.object.scale.multiplyScalar(1e5);

  });

  scene.add(satellite.object);
  satellites.push(satellite);

  //initSpeed(satellite, new Vector3(0, 0, 1).normalize(), s);
  initSpeed(satellite, Vi.normalize(), speed);

  const arrowHelper = new THREE.ArrowHelper(new Vector3(), satellite.object.position, 1, 0xff0000);
  scene.add(arrowHelper);
  satellite.arrows.push(arrowHelper);

  const arrowHelper1 = new THREE.ArrowHelper(new Vector3(), satellite.object.position, 1, 0x0000ff);
  scene.add(arrowHelper1);
  satellite.arrows.push(arrowHelper1);

  const arrowHelper2 = new THREE.ArrowHelper(new Vector3(), satellite.object.position, 1, 0x00ff00);
  scene.add(arrowHelper2);
  satellite.arrows.push(arrowHelper2);
}

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

const camera = cameraFunc(sizes, sun);

const renderer = rendererFunc();

misc(scene, camera, renderer, sizes);

lights(scene, sun);

renderer.render(scene, camera);

const controls = new OrbitControls(camera, renderer.domElement);

export function initSpeed(satellite, vec, V) {
  satellite.V.add(vec.multiplyScalar(V));
}

function drawTrail(satellite, V) {
  const origin = satellite.object.position;
  const length = 1e6;
  const hex = 0xffff00;

  const arrowHelper = new THREE.ArrowHelper(new Vector3(), origin, length, hex);
  scene.add(arrowHelper);
  const temp = new Vector3().copy(V);
  temp.normalize();
  const newSourcePos = satellite.object.position;
  var newTargetPos = temp;
  arrowHelper.position.set(newSourcePos.x, newSourcePos.y, newSourcePos.z);
  const direction = new THREE.Vector3().copy(newTargetPos);
  arrowHelper.setDirection(direction.normalize());
  arrowHelper.setLength(temp.length() * 1e5);

  setTimeout(removeTrail, 7e4, arrowHelper);
}

function removeTrail(arrowHelper) {
  scene.remove(arrowHelper);
}

function drawVector(satellite, V, i) {

  const temp = new Vector3().copy(V);
  temp.normalize();
  const newSourcePos = satellite.object.position;
  var newTargetPos = temp;
  satellite.arrows[i].position.set(newSourcePos.x, newSourcePos.y, newSourcePos.z);
  const direction = new THREE.Vector3().copy(newTargetPos);
  satellite.arrows[i].setDirection(direction.normalize());
  satellite.arrows[i].setLength(V.length() * 1e6);
}

const gravity = new Vector3();

function applyGravity(satellite) {
  gravity.subVectors(earth.position, satellite.object.position);
  const distanceSq = gravity.lengthSq();
  const gravityForce = (GRAVITY_CONSTANT * earth_mass_object.EARTH_MASS * satellite.mass) / distanceSq;
  gravity.normalize().multiplyScalar(gravityForce);
  
  gravity.divideScalar(satellite.mass);

  let index = satellites.indexOf(satellite);

  //collision detection with Earth
  //delete collided satellite
  if (satellite.object.position.lengthSq() < EARTH_RADIUS_SQ) {
    if (index > -1) {
      satellites.splice(index, 1);
      scene.remove(satellite);
      satellite.object.visible = false;
      satellite.arrows.forEach(arrow => {
        scene.remove(arrow);
      });
      destroyFolder(index);
    }
  }
}

const DA = new Vector3();
function dragForce(satellite) {
  const DForce = 0.5 * VOLUMEETRIC_DENSITY * AREA * satellite.V.lengthSq() * DRAG_COEFFICIENT;// Tareq Drag Force equation
  const temp = new Vector3();
  temp.copy(satellite.V).normalize().multiplyScalar(-1);
  DA.copy(temp).multiplyScalar(DForce);
  DA.divideScalar(satellite.mass);
}

let previousTime = Date.now();

const distanceVector = new Vector3();

function animate() {
  const currentTime = Date.now();
  const deltaTime = (currentTime - previousTime) * time.timeScale / 1000;//////////TODO what is /10 (remove later??)
  previousTime = currentTime;

  satellites.forEach(satellite => {


    if (satellite.object.visible) {
      applyGravity(satellite);
      satellite.height = calculate_height(satellite.object.position)
      if (satellite.height < 6e5) {
        dragForce(satellite);
      }

      const tempV = new Vector3();
      tempV.copy(gravity).multiplyScalar(deltaTime)
      satellite.V.add(tempV);

      const tempV2 = new Vector3();
      tempV2.copy(DA).multiplyScalar(deltaTime);
      satellite.V.add(tempV2);

      satellite.displacement.copy(satellite.V).multiplyScalar(deltaTime);
      satellite.object.position.add(satellite.displacement);

      drawVector(satellite, new Vector3().copy(satellite.V).normalize(), 0);
      drawVector(satellite, gravity, 1);
      drawVector(satellite, DA, 2);
      drawTrail(satellite, satellite.V);

    }
  });

  for (let i = 0; i < satellites.length; i++) {
    const element = satellites[i];
    if (satellites.length > 1) {
      for (let j = i; j < satellites.length; j++) {
        if (i != j) {
          const element2 = satellites[j];
          distanceVector.subVectors(element.object.position, element2.object.position);
          const distance = distanceVector.lengthSq();
          if (distance < 70000000000) {
            scene.remove(element.object, element2.object);

            satellites.splice(i, 1);
            satellites.splice(j, 1);

            element.object.visible = false;
            element2.object.visible = false;

            satellitesFolders[i].destroy()
            satellitesFolders[j].destroy()

            satellitesFolders.splice(i, 1)
            satellitesFolders.splice(j, 1)


            element.arrows.forEach(arrow => {
              scene.remove(arrow);
            });
            element2.arrows.forEach(arrow => {
              scene.remove(arrow);
            });
          }
        }
      }
    }
  }

  earth.rotateY(1.2120351080246913580246913580247e-6 * time.timeScale);

  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  updatePrototype();
}
animate();

export function removeSatelliteFromScene(index) {
  let satToBeDeleted = satellites.at(index)
  satToBeDeleted.arrows.forEach(arrow => {
    scene.remove(arrow);
  });
  satToBeDeleted.object.visible = false;
  scene.remove(satToBeDeleted.object)
}