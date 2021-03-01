/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TensorFlow.js template
 * https://github.com/Polarisation/react-native-template-tfjs
 *
 * @format
 * @flow
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  View,
  Text,
  Image,
} from 'react-native';
import VideoPlayer from 'react-native-video-player'
import { Camera } from 'expo-camera';
import * as Permissions from 'expo-permissions';
import * as facemesh from "@tensorflow-models/facemesh";
import { LogLevel, RNFFmpeg,RNFFprobe } from 'react-native-ffmpeg';
import * as FileSystem from 'expo-file-system';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { decodeJpeg } from '@tensorflow/tfjs-react-native'

const App: () => React$Node = () => {
  // State to indicate if TensorFlow.js finished loading
  const [isTfReady, setTfReady] = useState(false);
  const [camera, setCamera] = useState({
    hasCameraPermission: null,
    type: Camera.Constants.Type.front,
    hasAudioPermission: null,
  });
  const [recording, setRecording] = useState(false)
  const [recordedVideo,setRecordedVideo] = useState(null)
  const [model,setModel] = useState(null)
  const [progress,setProgress] = useState(0)
  const cameraRef = useRef(null)


  useEffect(() => {
    async function waitForTensorFlowJs() {
      await tf.ready();
      const model = await facemesh.load({
        maxFaces:1,
        inputResolution: { width: 1280, height: 720 },
        scale: 0.8,
          });
      setModel(model)
      setTfReady(true);
      console.log("tf is ready")   
    }
    waitForTensorFlowJs();
    askForPermission()
  }, []);

  const askForPermission = async () => {
    const { status } = await Permissions.askAsync(
      Permissions.CAMERA,
      Permissions.AUDIO_RECORDING
    );
    console.log(status, "status")
    if (status === "granted") {
      setCamera(prevState => ({ ...prevState, hasCameraPermission: status }));
      setCamera(prevState => ({ ...prevState, hasAudioPermission: status }));
    }
  }


  const startRecording = async () => {
    setRecording(true)
    const { uri, codec = 'mp4' } = await cameraRef.current.recordAsync();  
    extractFrames(uri)
  }

  const stopRecording = async () => {
    setRecording(false)
    cameraRef.current.stopRecording();
  };

  const extractFrames=async(uri)=>{
    const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.cacheDirectory}/frames/`)
    if(dirInfo.exists){
    const deletes = await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}/frames/`)
    console.log(deletes,"deletes")
    await FileSystem.makeDirectoryAsync(`${FileSystem.cacheDirectory}/frames/`)
  }
  else{
    await FileSystem.makeDirectoryAsync(`${FileSystem.cacheDirectory}/frames/`)
  }
    let outputVideoPath = `${FileSystem.cacheDirectory}/frames/image%d.jpg`;
    await RNFFmpeg.executeWithArguments(["-i", `${uri}`,"-r","30/1",`${outputVideoPath}`]).then(info=>{
      console.log(info,"info")
    })
    setRecordedVideo(uri) 
    RNFFprobe.getMediaInformation(uri).then(information => {
      if (information.getMediaProperties() !== undefined) {
          let streams = information.getStreams();
          if (streams !== undefined) {
                     runModel(parseInt(streams[0].getAllProperties().nb_frames.toString()))
                 }
      }
  });
  }

  const runModel=async(noOfFrames)=>{
    const data=[]
    await FileSystem.writeAsStringAsync(FileSystem.cacheDirectory + 'keyframes.json', JSON.stringify(data));
    for(var i=1;i<=noOfFrames;i++){
    const imgB64 = await FileSystem.readAsStringAsync(`${FileSystem.cacheDirectory}/frames/image${i}.jpg`, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const imgBuffer = tf.util.encodeString(imgB64, 'base64').buffer;
    const raw = new Uint8Array(imgBuffer)  
    const imageTensor = decodeJpeg(raw);
if(model!==null){
  const faceEstimate = await model.estimateFaces(imageTensor,predictIrises=false);
  console.log(faceEstimate.length,"face")
  if(faceEstimate.length>0){
    var jsonFile = await FileSystem.readAsStringAsync(FileSystem.cacheDirectory + 'keyframes.json')
    var json = JSON.parse(jsonFile)
    json.push(faceEstimate[0])
    await FileSystem.writeAsStringAsync(FileSystem.cacheDirectory + 'keyframes.json', JSON.stringify(json));
    console.log(json,"jsonfile")
    const keypoints = faceEstimate[0].scaledMesh;
      const [x, y, z] = keypoints[5];
      console.log(`Keypoint ${5}: [${x}, ${y}, ${z}]`);
  }
  tf.dispose([imageTensor]);
}
setProgress(Math.round((i*100)/noOfFrames))
}

  }


  return (
    <>
 
{isTfReady ?
<View style={styles.container}>
        {(camera.hasCameraPermission === "granted" && camera.hasAudioPermission === "granted") ? 
        <View style={styles.container}>
               {recordedVideo ? 
               <ScrollView>
        <Text style={styles.text}>{progress}% Done</Text>
        {progress===100 && 
        <View>
          <Text style={styles.text}>Saved as keypoints.json</Text>
        <TouchableOpacity onPress={()=>{setRecordedVideo(null);setProgress(0)}} style={styles.capture}>
           <Text style={{ fontSize: 14,color:"white" }}> Record Again </Text>
         </TouchableOpacity>
         <VideoPlayer
             video={{uri:recordedVideo}}
             videoWidth={1600}
             videoHeight={900}
         />
         </View>}
         </ScrollView>
               :<View style={styles.container}>
        <Camera ref={cameraRef} style={styles.preview} type={camera.type}>
        </Camera>
         <View style={{ flex: 0, flexDirection: 'row', justifyContent: 'center' }}>
         {!recording && <TouchableOpacity onPress={startRecording} style={styles.capture}>
           <Text style={{ fontSize: 14,color:"white" }}> Record </Text>
         </TouchableOpacity>}
         {recording && <TouchableOpacity onPress={stopRecording} style={styles.capture}>
           <Text style={{ fontSize: 14,color:"white" }}> Stop </Text>
         </TouchableOpacity>}
         </View>
         </View>}
         </View>
          :
          <View>
            <Text style={styles.text}>Please Provide Permission</Text>
          </View>
        }
        </View>
        :
        <View style={styles.container}>
          <Text style={styles.text}>Loading Facemesh...</Text>
        </View>
        }
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#fff',
  },
  engine: {
    position: 'absolute',
    right: 0,
  },
  text: {
    marginTop:20,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold',
    backgroundColor: '#fff',
    fontSize:20,
    lineHeight:30,
    textAlign:'center'
},
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  capture: {
    flex: 0,
    color:"white",
    backgroundColor: 'black',
    borderRadius: 5,
    padding: 15,
    paddingHorizontal: 20,
    alignSelf: 'center',
    margin: 20,
  },
  preview: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    height: 300
  },
  image:{
    width:400,
    height:600
  }
});

export default App;
