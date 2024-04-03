import '../css/index.css'
import gsap from 'gsap'
import * as THREE from 'three';

import vertexShader from '../shadders/vertex.glsl'
import fragmentShader from '../shadders/fragment.glsl'
//Atmosphere
import atmosphereVertexShader from '../shadders/atmosphereVertex.glsl'
import atmosphereFragmentShader from '../shadders/atmosphereFragment.glsl'
import textureGlobe from '../img/globe.jpg'

//Axios
import axios from "axios";

let countries = [];
let countriesLoaded = false;
//Canvas
const canvasContainer = document.querySelector('#canvasContainer')

getCountries().then(() => {
    if (countriesLoaded) {

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x010101);
        let camera = new THREE.PerspectiveCamera(75, canvasContainer.offsetWidth / canvasContainer.offsetHeight, 0.1, 1000)
        camera.position.z = 15
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            canvas: document.querySelector('canvas')
        })
        renderer.setSize(canvasContainer.offsetWidth, canvasContainer.offsetHeight)
        renderer.setPixelRatio(window.devicePixelRatio)

        //Create Sphere
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(5, 50, 50),
            new THREE.ShaderMaterial({
                vertexShader,
                fragmentShader,
                uniforms: {
                    globeTexture: {
                        value: new THREE.TextureLoader().load(textureGlobe)
                    }
                }
            })
        )


        //Create Atmosphere
        const atmosphere = new THREE.Mesh(
            new THREE.SphereGeometry(5, 50, 50),
            new THREE.ShaderMaterial({
                vertexShader: atmosphereVertexShader,
                fragmentShader: atmosphereFragmentShader,
                blending: THREE.AdditiveBlending,
                side: THREE.BackSide
            })
        )

        atmosphere.scale.set(1.1, 1.1, 1.1)

        scene.add(atmosphere)

        const group = new THREE.Group()
        group.add(sphere)
        scene.add(group)

        //Stars
        const starGeometry = new THREE.BufferGeometry();
        const starMaterial = new THREE.PointsMaterial({
            color: 0xDDDDDD,
            size: 1,
            sizeAttenuation: true,
        });

        const starVertices = [];

        for (let i = 0; i < 10000; i++) {
            const x = (Math.random() - 0.5) * 1000;
            const y = (Math.random() - 0.5) * 1000;
            const z = -Math.random() * 1000;
            starVertices.push(x, y, z);
        }

        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const stars = new THREE.Points(starGeometry, starMaterial);
        scene.add(stars);

        function createBoxes() {
            countries.forEach((country) => {
                // //Create Points
                const scale = country.population / 1000000000
                const zScale = 0.8 * scale
                const box = new THREE.Mesh(
                    new THREE.BoxGeometry(
                        Math.max(0.1, 0.1 * scale),
                        Math.max(0.1, 0.1 * scale),
                        Math.max(zScale, 0.4 * Math.random())),
                    new THREE.MeshBasicMaterial({
                        color: '#C0EDFF',
                        opacity: 0.5,
                        transparent: true
                    })
                )

                const latitude = (country.latlng[0] / 180) * Math.PI
                const longitude = (country.latlng[1] / 180) * Math.PI
                const radius = 5

                const x = radius * Math.cos(latitude) * Math.sin(longitude)
                const y = radius * Math.sin(latitude)
                const z = radius * Math.cos(latitude) * Math.cos(longitude)

                box.position.x = x
                box.position.y = y
                box.position.z = z

                box.lookAt(0, 0, 0)
                box.geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -zScale / 2))

                group.add(box)

                gsap.to(box.scale, {
                    z: 1.4,
                    duration: 2,
                    yoyo: true,
                    repeat: -1,
                    ease: 'linear',
                    delay: Math.random()
                })

                box.country = country.name.common
                box.population = new Intl.NumberFormat().format(country.population)
                box.maps = country.maps.googleMaps
            })
        }

        createBoxes()

        sphere.rotation.y = -Math.PI / 2

        group.rotation.offset = {
            x: 0,
            y: 0
        }

        const mouse = {
            x: undefined,
            y: undefined,
            down: false,
            xPrev: undefined,
            yPrev: undefined
        }

        const raycaster = new THREE.Raycaster()
        const popUpEl = document.querySelector('#popUpEl')
        const populationEl = document.querySelector('#populationEl')
        const populationValueEl = document.querySelector('#populationValueEl')

        function animate() {
            requestAnimationFrame(animate)
            renderer.render(scene, camera)

            raycaster.setFromCamera(mouse, camera)

            const intersects = raycaster.intersectObjects(group.children.filter(mesh => mesh.geometry.type === 'BoxGeometry'));

            group.children.forEach((mesh) => {
                mesh.material.opacity = 0.5
            })

            gsap.set(popUpEl, {
                display: 'none'
            })

            for (let i = 0; i < intersects.length; i++) {
                const box = intersects[i].object
                box.material.opacity = 1;
                gsap.set(popUpEl, {
                    display: 'block'
                })
                populationEl.innerHTML = box.country
                populationValueEl.innerHTML = box.population
            }

            renderer.render(scene, camera)
        }

        animate()

        canvasContainer.addEventListener('mousedown', ({clientX, clientY}) => {
            mouse.down = true
            mouse.xPrev = clientX
            mouse.yPrev = clientY
        })

        addEventListener('mousemove', (event) => {
            if (innerWidth >= 1200) {
                mouse.x = ((event.clientX - innerWidth / 2) / (innerWidth / 2)) * 2 - 1
                mouse.y = -(event.clientY / innerHeight) * 2 + 1
            } else {
                const offset = canvasContainer.getBoundingClientRect().top
                mouse.x = (event.clientX / innerWidth) * 2 - 1
                mouse.y = -((event.clientY - offset) / innerHeight) * 2 + 1
            }

            gsap.set(popUpEl, {
                x: event.clientX,
                y: event.clientY
            })

            if (mouse.down) {
                event.preventDefault()

                const deltaX = event.clientX - mouse.xPrev
                const deltaY = event.clientY - mouse.yPrev

                group.rotation.offset.x += deltaY * 0.005
                group.rotation.offset.y += deltaX * 0.005

                gsap.to(group.rotation, {
                    y: group.rotation.offset.y,
                    x: group.rotation.offset.x,
                    duration: 2
                })

                mouse.xPrev = event.clientX
                mouse.yPrev = event.clientY
            }
        })

        addEventListener('mouseup', () => {
            mouse.down = false
        })

        addEventListener('touchmove', (event) => {
            event.clientX = event.touches[0].clientX
            event.clientY = event.touches[0].clientY

            const doesIntersect = raycaster.intersectObject(sphere)

            if (doesIntersect.length > 0) mouse.down = true

            if (mouse.down) {
                const offset = canvasContainer.getBoundingClientRect().top
                mouse.x = (event.clientX / innerWidth) * 2 - 1
                mouse.y = -((event.clientY - offset) / innerHeight) * 2 + 1

                gsap.set(popUpEl, {
                    x: event.clientX,
                    y: event.clientY
                })

                if (mouse.down) {
                    event.preventDefault()

                    const deltaX = event.clientX - mouse.xPrev
                    const deltaY = event.clientY - mouse.yPrev

                    group.rotation.offset.x += deltaY * 0.005
                    group.rotation.offset.y += deltaX * 0.005

                    gsap.to(group.rotation, {
                        y: group.rotation.offset.y,
                        x: group.rotation.offset.x,
                        duration: 2
                    })

                    mouse.xPrev = event.clientX
                    mouse.yPrev = event.clientY
                }
            }
        }, {passive: false})

        addEventListener('touchend', () => {
            mouse.down = false
        })

        addEventListener('resize', () => {
            renderer.setSize(canvasContainer.offsetWidth, canvasContainer.offsetHeight)
            camera = new THREE.PerspectiveCamera(75, canvasContainer.offsetWidth / canvasContainer.offsetHeight, 0.1, 1000)
            camera.position.z = 15
        })
    }
})


//Get the countries

async function getCountries() {
    try {
        const response = await axios.get('https://restcountries.com/v3.1/all');
        countries = response.data;
        countriesLoaded = true
    } catch (error) {
        alert('An error occurred while obtaining the information');
    }
}
