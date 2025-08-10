"""
ResUNet50 Model Definition with ResNet50 as encoder
Corrected: Up block handles concat channel math correctly.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models

class DoubleConv(nn.Module):
    """(convolution => [BN] => ReLU) * 2"""
    def __init__(self, in_channels, out_channels, mid_channels=None):
        super().__init__()
        if not mid_channels:
            mid_channels = out_channels
        self.double_conv = nn.Sequential(
            nn.Conv2d(in_channels, mid_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(mid_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(mid_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True)
        )

    def forward(self, x):
        return self.double_conv(x)

class Up(nn.Module):
    """Upscaling then double conv with skip connections.

    in_channels: channels of the tensor being upsampled (input to Up)
    skip_channels: channels of the corresponding encoder skip tensor
    out_channels: desired output channels after DoubleConv
    """
    def __init__(self, in_channels, skip_channels, out_channels, bilinear=True):
        super().__init__()
        # transpose conv upsamples: in_channels -> in_channels//2
        self.up = nn.ConvTranspose2d(in_channels, in_channels // 2, kernel_size=2, stride=2)
        # after up, channels = in_channels//2; after concat channels = in_channels//2 + skip_channels
        self.conv = DoubleConv(in_channels // 2 + skip_channels, out_channels)

    def forward(self, x1, x2):
        # x1 : tensor from previous decoder stage (to be upsampled)
        # x2 : skip connection tensor from encoder
        x1 = self.up(x1)
        # pad if necessary (due to rounding in pooling/upsampling)
        diffY = x2.size()[2] - x1.size()[2]
        diffX = x2.size()[3] - x1.size()[3]
        x1 = F.pad(x1, [diffX // 2, diffX - diffX // 2,
                        diffY // 2, diffY - diffY // 2])
        x = torch.cat([x2, x1], dim=1)
        return self.conv(x)

class ResUNet50(nn.Module):
    def __init__(self, out_channels=1, pretrained=True):
        super(ResUNet50, self).__init__()

        # torchvision weights API compatibility
        try:
            weights = models.ResNet50_Weights.IMAGENET1K_V1 if pretrained else None
            resnet = models.resnet50(weights=weights)
        except Exception:
            # fallback for older torchvision versions
            resnet = models.resnet50(pretrained=pretrained)

        # Input layer (conv1 + bn1 + relu + maxpool)
        self.input_layer = nn.Sequential(
            resnet.conv1,
            resnet.bn1,
            resnet.relu,
            resnet.maxpool
        )

        # Encoder layers (these are the ResNet blocks)
        # Note channel sizes (ResNet50):
        # after input_layer -> 64 channels (spatial reduced by /4 because of conv1 + maxpool)
        # layer1 -> 256 channels
        # layer2 -> 512 channels
        # layer3 -> 1024 channels
        # layer4 -> 2048 channels
        self.encoder1 = resnet.layer1  # x2 -> 256
        self.encoder2 = resnet.layer2  # x3 -> 512
        self.encoder3 = resnet.layer3  # x4 -> 1024
        self.encoder4 = resnet.layer4  # x5 -> 2048

        # Bottleneck: reduce 2048 -> 1024
        self.bottleneck = DoubleConv(2048, 1024)

        # Decoder (Up blocks)
        # Up(in_from_prev, skip_from_encoder, out_channels)
        # after up: in_channels//2 then concat with skip -> DoubleConv(in_channels//2 + skip_channels, out_channels)
        self.up4 = Up(1024, 1024, 512)  # x5 (1024) up->512 concat x4(1024) => 1536 -> conv -> 512
        self.up3 = Up(512, 512, 256)    # 512 -> 256 concat x3(512) => 768 -> conv -> 256
        self.up2 = Up(256, 256, 128)    # 256 -> 128 concat x2(256) => 384 -> conv -> 128
        self.up1 = Up(128, 64, 64)      # 128 -> 64  concat x1(64)  => 128 -> conv -> 64

        # Final output conv
        self.outc = nn.Conv2d(64, out_channels, kernel_size=1)

    def forward(self, x):
        # Encoder
        x1 = self.input_layer(x)   # after conv1+maxpool
        x2 = self.encoder1(x1)     # layer1
        x3 = self.encoder2(x2)     # layer2
        x4 = self.encoder3(x3)     # layer3
        x5 = self.encoder4(x4)     # layer4

        # Bottleneck
        x5 = self.bottleneck(x5)

        # Decoder with skip connections
        x = self.up4(x5, x4)
        x = self.up3(x, x3)
        x = self.up2(x, x2)
        x = self.up1(x, x1)

        logits = self.outc(x)
        return torch.sigmoid(logits)

# Test function to verify model works
def test_model():
    """Test the model with dummy input"""
    model = ResUNet50(out_channels=1, pretrained=False)  # set pretrained=False for faster test
    model.eval()

    # Create dummy input (batch_size=1, channels=3, height=256, width=256)
    dummy_input = torch.randn(1, 3, 256, 256)

    with torch.no_grad():
        output = model(dummy_input)

    print("Model test successful!")
    print(f"Input shape: {dummy_input.shape}")
    print(f"Output shape: {output.shape}")

    return True

if __name__ == "__main__":
    test_model()
