import { render } from '@testing-library/react';
import React from 'react';
import DragDropWrapper from './DragDropWrapper';

// Simulation Import
import triangleVertWGSL from '!!raw-loader!./shaders/triangle.vert.wgsl';
import redFragWGSL from '!!raw-loader!./shaders/red.frag.wgsl';

type Props = {

}

// The callback to compute if we should request another render frame has a hard time playing with react state, so we have an external vairable to mirror state.
// This is bad, so maybe replace in the future.
let externalRunning = false;
let frame = 0;

const Apiary = ({} : Props) => {
  // If we are loading. There is a lot of initialization code that we need to wait for.
  const [loading, setLoading] = React.useState<boolean>(true);

  // References to our WebGPU specific variables.
  const [device, setDevice]  = React.useState<GPUDevice>();
  const [context, setContext]  = React.useState<GPUCanvasContext>();
  const [pipeline, setPipeline] = React.useState<GPURenderPipeline>();
  const [format, setFormat] = React.useState<GPUTextureFormat>();

  // Simulation States and variables
  const [width, setWidth] = React.useState<number>(0);
  const [height, setHeight] = React.useState<number>(0);
  const [aspectRatio, setAspectRatio] = React.useState<number>(0);
  const [running, setRunning] = React.useState<boolean>(false);
  const [fps, setFPS] = React.useState<number>(0);
  
  // If we have encountered an error while loading.
  const [error, setError] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string>("");

  // Create a ref to use in our canvas
  const canvasRef = React.useRef(null);

  // Initialization Hooks
  React.useEffect(() => {
    // If we have a canvas Reference.
    if (canvasRef != null) {
      // Attach a resize observer
      const resizeCallback : ResizeObserverCallback = (events : Array<ResizeObserverEntry>) => {
        // if we have at least one resize event
        if (events.length > 0) {
          // Get the first
          const event : ResizeObserverEntry = events[0];
          
          const width = event.contentRect.width;
          const height = event.contentRect.height;
          // Use this events callbacks to set our canvas pixel width and height and derive AspectRatio.
          setWidth(width);
          setHeight(height);
          setAspectRatio(width / height);
        }
      }
      const resizeObserver = new ResizeObserver(resizeCallback);
      // @ts-ignore
      resizeObserver.observe(canvasRef.current);
      
      // @ts-ignore
      const webGPUContext = canvasRef.current.getContext("webgpu");
      setContext(webGPUContext);

      // Define a callback function to call when cleanup is called.
      const cleanup = () => {
        resizeObserver.disconnect();
        shutdown();
      }

      // @ts-ignore
      if (!navigator.gpu) {
        processError('WebGPU not supported.');
        return cleanup;
      } else {
        // @ts-ignore
        navigator.gpu.requestAdapter().then((adapter) => {
          if (!adapter) {
            throw Error("Couldn't request WebGPU adapter.");
          }
          console.log("adapter:", adapter)
          // @ts-ignore
          adapter.requestDevice().then((device) => {
            console.log("Device:", device)
            // Set our device.
            setDevice(device);
            // Set our format.
            let theFormat = navigator.gpu.getPreferredCanvasFormat();
            setFormat(theFormat);
            // Configure our context
            console.log(webGPUContext)
            webGPUContext.configure({
              device: device,
              // @ts-ignore
              format: theFormat,
              alphaMode: "premultiplied",
            });

            const pipeline = device.createRenderPipeline({
              layout: 'auto',
              vertex: {
                module: device.createShaderModule({
                  // @ts-ignore
                  code: triangleVertWGSL,
                }),
              },
              fragment: {
                module: device.createShaderModule({
                  // @ts-ignore
                  code: redFragWGSL,
                }),
                targets: [
                  {
                    format: theFormat,
                  },
                ],
              },
              primitive: {
                topology: 'triangle-list',
              },
            });
            setPipeline(pipeline);

            // Now run Initialization
            init();
            // Now that everything has been initialized, request a render frame
            play();
            // When this component is unmounted call shutdown.
            return cleanup;
          });
        })
      }
    }
  }, [canvasRef]);

  // Hook to run the render loop
  const startRender = React.useEffect(() => {
    // Mirror the state to externalRunning.
    externalRunning = running;
    if (running) {
      // Play
      _internalRenderFrame();
    } else {
      // Pause
      // End Running
    }
  }, [running]);

  let last = Date.now();
  let runningDelta = 0;
  let FPS = 0;
  const _internalRenderFrame = () => {
    if (isRunning()) {
      // Timing Information
      let now = Date.now();
      let delta = (now - last) / 1_000;
      FPS++;
      frame += 1;
      runningDelta += delta;

      // Render the frame
      renderFrame(delta);

      // Update the last time, and print out FPS if applicable.
      last = now;
      if (runningDelta > 1.0) {
        // Decrement
        runningDelta -= 1.0;
        setFPS(FPS);
        // Reset our FPS counter
        FPS = 0;
      }
      requestAnimationFrame(_internalRenderFrame);
    }
  }

  const isRunning = () => {
    return externalRunning;
  }

  // Helper function for setting that we have an error.
  const processError = (errorMessage : string) => {
    setLoading(false);
    setErrorMessage(errorMessage);
  }

  // Control Variables
  const play = () => {
    if (!running) {
      setRunning(true);
      onPlay();
    }
  }

  const pause = () => {
    if (running) {
      setRunning(false);
      setFPS(0);
      onPause();
    }
  }

  // Functions to call to init and shutdown our canvas
  const init = () => {
    if (device && format) {
      console.log("Init")
    }
  }

  const onPlay = () => {
    console.log("On Play");
  }

  const onPause = () => {
    console.log("On Pause");
  }

  const renderFrame = (delta : number) => {
    // console.log("Render:", delta);

    // @ts-ignore
    const commandEncoder = device.createCommandEncoder();
    // @ts-ignore
    const textureView = context.getCurrentTexture().createView();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      // @ts-ignore
      colorAttachments: [
        {
          view: textureView,
          clearValue: [Math.abs(Math.sin(frame / 180)), Math.abs(Math.sin((frame + 120) / 180)), Math.abs(Math.sin((frame + 240) / 180)), 1], // Clear to transparent
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    if (pipeline) {
      passEncoder.setPipeline(pipeline);
      passEncoder.draw(3); // Draw call
    }
    passEncoder.end();
    // @ts-ignore
    device.queue.submit([commandEncoder.finish()]);
  }

  const shutdown = () => {
    
  }

  // Render
  return <>
    <DragDropWrapper onDrop={() => {

    }}>
      <canvas ref={canvasRef} width={width} height={height} style={{width:'100%', height:'100%', aspectRatio:'1'}}/>
      <div style={{position:'absolute', top:'0'}}>
        {error ? errorMessage : ''}
        <div>{fps}</div>
        <div>{width}</div>
        <div>{height}</div>
        <div>{aspectRatio}</div>
        <button onClick={(event) => {
          running ? pause() : play()
        }}>{running ? 'Pause' : 'Play'}</button>
      </div>
    </DragDropWrapper>
  </>
}

export default Apiary;