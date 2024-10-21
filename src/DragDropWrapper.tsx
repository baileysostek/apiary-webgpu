import React, { DragEvent, DragEventHandler, ReactElement } from 'react';

type Props = {
  onDrop : () => void;
  acceptedFileTypes ?: Array<string>;
  children : Array<ReactElement>;
}

const DragDropWrapper = ({onDrop, children} : Props) => {
  // OnDrop
  const fileDropHandler : DragEventHandler = (event : DragEvent) => {
    event.stopPropagation();
    event.preventDefault();
    console.log('event', event);
  };

  // Render our DragDrop wrapper
  return <div onDrop={fileDropHandler} onDragOver={(event) => event.preventDefault()}>
    {children}
  </div>
}
export default DragDropWrapper