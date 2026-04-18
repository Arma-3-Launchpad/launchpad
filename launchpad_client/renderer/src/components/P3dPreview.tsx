import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export type P3dPreviewProps = {
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
  className?: string
}

function boundsFromPositions(positions: Float32Array): { center: THREE.Vector3; size: number } {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity)
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
  for (let i = 0; i < positions.length; i += 3) {
    min.x = Math.min(min.x, positions[i]!)
    min.y = Math.min(min.y, positions[i + 1]!)
    min.z = Math.min(min.z, positions[i + 2]!)
    max.x = Math.max(max.x, positions[i]!)
    max.y = Math.max(max.y, positions[i + 1]!)
    max.z = Math.max(max.z, positions[i + 2]!)
  }
  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5)
  const size = max.distanceTo(min) || 1
  return { center, size }
}

function DampedControls() {
  const { camera, gl } = useThree()
  const controlsRef = useRef<OrbitControls | null>(null)
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.enableDamping = true
    c.dampingFactor = 0.08
    controlsRef.current = c
    return () => {
      c.dispose()
      controlsRef.current = null
    }
  }, [camera, gl])
  useFrame(() => {
    controlsRef.current?.update()
  })
  return null
}

function PreviewMesh({
  positions,
  normals,
  indices,
}: {
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
}) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    g.setIndex(new THREE.Uint32BufferAttribute(indices, 1))
    g.computeBoundingSphere()
    return g
  }, [positions, normals, indices])

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#b8c4d4" metalness={0.05} roughness={0.65} flatShading />
    </mesh>
  )
}

function SceneContent(props: Omit<P3dPreviewProps, 'className'>) {
  const { center, size } = useMemo(() => boundsFromPositions(props.positions), [props.positions])
  const { camera } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const dist = Math.max(size * 1.4, 0.5)
    cam.position.set(center.x + dist * 0.85, center.y + dist * 0.55, center.z + dist * 0.85)
    cam.near = Math.max(0.001, dist / 2000)
    cam.far = Math.max(500, dist * 50)
    cam.updateProjectionMatrix()
    cam.lookAt(center)
  }, [camera, center, size])

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 10, 6]} intensity={0.9} castShadow={false} />
      <directionalLight position={[-6, 4, -3]} intensity={0.25} />
      <PreviewMesh {...props} />
      <DampedControls />
    </>
  )
}

/**
 * Interactive glTF-style preview for decoded ``.p3d`` mesh data (desktop shell).
 */
export function P3dPreview({ positions, normals, indices, className }: P3dPreviewProps) {
  return (
    <div className={['mission-image-preview', 'mission-p3d-preview', className].filter(Boolean).join(' ')}>
      <div className="mission-image-preview-frame mission-p3d-preview-frame">
        <div className="mission-p3d-preview-canvas-wrap">
          <Canvas
            gl={{ antialias: true, alpha: true }}
            onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
            camera={{ fov: 45, near: 0.05, far: 5000 }}
            style={{ width: '100%', height: '100%', minHeight: 280 }}
          >
            <Suspense fallback={null}>
              <SceneContent positions={positions} normals={normals} indices={indices} />
            </Suspense>
          </Canvas>
        </div>
      </div>
    </div>
  )
}
